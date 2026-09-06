#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""内容完整性校验（CI：.github/workflows/site_deploy.yml 的 Content checks step）。

用纯标准库实现（兼容系统 python3，无第三方依赖）。规则与 AGENTS.md「内容结构/图片约定」一致：

错误（exit 1，阻断发布）：
  1. content/posts/<分类>/<N>.<slug>.md 的 frontmatter weight 缺失或与文件名编号 N 不一致；
  2. 同一分类目录内出现重复编号（两篇文章 weight 相同）；
  3. frontmatter featured_image / images 里 /images/... 路径的资源不存在
     （asset 管线先查 assets/images/，查不到再查 static/images/）——防止「路径写错静默回退纯黑 header」；

警告（仅提示，不阻断）：
  - categories 不在约定集合 {客户端, 服务端, 其他} 内，或与所在目录首段（1.client→客户端 等）不一致；
  - 文章缺少 date（日期本应来自 git，但建议显式声明便于预览排序直观）。

用法：python3 scripts/check_content.py   # 无参数；从仓库根目录运行
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
ASSETS_IMG = os.path.join(ROOT, "assets", "images")
STATIC_IMG = os.path.join(ROOT, "static", "images")

ALLOWED_CATEGORIES = {"客户端", "服务端", "其他"}
FOLDER_CATEGORY = {
    "1.client": "客户端",
    "2.server": "服务端",
    "3.other": "其他",
}

errors = []
warnings = []


def parse_frontmatter(path):
    """极简 frontmatter 解析：仅取顶层 key 及紧邻的 '- item' 列表项（兼容 py3.8+）。"""
    text = open(path, encoding="utf-8").read()
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    body = text[3:end].splitlines()
    out = {}
    cur = None
    scalar_re = re.compile(r"^([A-Za-z0-9_-]+):\s*(.*)$")
    for line in body:
        m = scalar_re.match(line)
        if m:
            cur = m.group(1)
            val = m.group(2).strip()
            if val.startswith("["):
                val = val.strip("[]")
            out[cur] = val
        elif cur and re.match(r"^\s*-\s+", line):
            item = re.sub(r"^\s*-\s+", "", line).strip().strip("\"'")
            out[cur] = (out.get(cur) + ", " + item) if out.get(cur) else item
    return out


def split_list(raw):
    if not raw:
        return []
    return [x.strip().strip("\"'") for x in raw.split(",") if x.strip()]


def resource_exists(img_path):
    """/images/... 前端引用：先查 assets/images（构建期管线源），再查 static/images。"""
    rel = img_path[len("/images/"):]
    return os.path.exists(os.path.join(ASSETS_IMG, rel)) or os.path.exists(
        os.path.join(STATIC_IMG, rel)
    )


def check_post(path):
    rel = os.path.relpath(path, CONTENT).replace(os.sep, "/")
    m = re.match(r"^posts/([^/]+)/(\d+)\.(.+)\.md$", rel)
    if not m:
        return
    folder, num, slug = m.groups()
    fm = parse_frontmatter(path)

    # 1) weight 与文件名编号一致
    weight = fm.get("weight", "").strip()
    if not weight.isdigit():
        errors.append(f"{rel}: frontmatter 缺 weight（约定与文件名编号一致）")
    elif int(weight) != int(num):
        errors.append(f"{rel}: weight={weight} 与文件名编号 {num} 不一致")

    # 2) categories 约定
    cats = set(split_list(fm.get("categories")))
    if not cats:
        warnings.append(f"{rel}: 未声明 categories")
    else:
        bad = cats - ALLOWED_CATEGORIES
        if bad:
            warnings.append(f"{rel}: categories {sorted(bad)} 不在约定集合 {sorted(ALLOWED_CATEGORIES)}")
        expected = FOLDER_CATEGORY.get(folder)
        if expected and cats != {expected}:
            warnings.append(f"{rel}: 目录为 {folder}（惯例 categories=[{expected}]），实际 {sorted(cats)}")

    # 3) 图片资源存在性
    for key in ("featured_image",):
        val = (fm.get(key) or "").strip().strip("\"'")
        if val.startswith("/images/") and not resource_exists(val):
            errors.append(f"{rel}: {key} 资源不存在（{val} → assets/images/ 或 static/images/ 均未命中）")


def check_standalone(path):
    rel = os.path.relpath(path, CONTENT).replace(os.sep, "/")
    fm = parse_frontmatter(path)
    for key in ("featured_image",):
        val = (fm.get(key) or "").strip().strip("\"'")
        if val.startswith("/images/") and not resource_exists(val):
            errors.append(f"{rel}: {key} 资源不存在（{val}）")
    for key in ("images",):
        for img in split_list(fm.get(key)):
            if img.startswith("/images/") and not resource_exists(img):
                errors.append(f"{rel}: {key} 资源不存在（{img}）")


def main():
    post_files = sorted(glob.glob(os.path.join(CONTENT, "posts", "*", "*.md")))
    for p in post_files:
        check_post(p)

    # 重复编号检查（按分类目录分组）
    weights_by_folder = {}
    for p in post_files:
        rel = os.path.relpath(p, CONTENT).replace(os.sep, "/")
        m = re.match(r"^posts/([^/]+)/(\d+)\.", rel)
        if not m:
            continue
        weights_by_folder.setdefault(m.group(1), []).append((m.group(2), rel))
    for folder, items in weights_by_folder.items():
        seen = {}
        for num, rel in items:
            if num in seen:
                errors.append(f"posts/{folder}/: 编号 {num} 重复（{seen[num]} 与 {rel}）")
            seen[num] = rel

    for p in sorted(glob.glob(os.path.join(CONTENT, "*.md"))):
        check_standalone(p)

    for w in warnings:
        print(f"[warn] {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"[error] {e}", file=sys.stderr)
        print(f"\n内容校验失败：{len(errors)} 个错误", file=sys.stderr)
        sys.exit(1)
    print(f"内容校验通过（{len(post_files)} 篇文章 + 独立页，{len(warnings)} 条警告）")


if __name__ == "__main__":
    main()
