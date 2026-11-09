#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全站 GEO/SEO 审计（发布后手动 / 定期运行，纯标准库）。

检查 sitemap 里的全部 URL、llms.txt、robots.txt：
  - HTTP 200（不跟随到错误页）
  - canonical 与 sitemap URL 一致
  - 无 noindex
  - title / description / H1 存在；description 长度 20–160
  - 全站 title / description 不重复
  - llms.txt / robots.txt 可访问，robots 声明 sitemap

用法：
  python3 scripts/seo_audit.py                    # 审计线上 https://orzmc.jokerhub.cn
  python3 scripts/seo_audit.py --base-url http://127.0.0.1:1313
  python3 scripts/seo_audit.py --jobs 4 --max-desc 180
退出码 1 = 有错误；0 = 通过（警告不影响）。
"""
from __future__ import annotations

import argparse
import concurrent.futures
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter

UA = "Mozilla/5.0 (compatible; OrzMC-SEO-Audit/1.0; +https://orzmc.jokerhub.cn)"
MIN_DESC = 20


def fetch(url: str, timeout: int = 30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.geturl(), resp.read().decode("utf-8", "replace")


def strip_query(url: str) -> str:
    return urllib.parse.urlsplit(url)._replace(query="", fragment="").geturl()


def text(pattern: str, html: str):
    m = re.search(pattern, html, re.S)
    return m.group(1).strip() if m else None


def audit_page(url: str, ts: str, max_desc: int) -> dict:
    try:
        status, _, html = fetch(f"{url}?seo_audit={ts}")
    except Exception as exc:  # noqa: BLE001 - 审计脚本需要把网络错误作为结果返回
        return {"url": url, "error": str(exc)}

    canon = text(r'<link rel=canonical href=([^ >]+)', html)
    robots = text(r'<meta name=robots content="([^"]*)"', html)
    desc = text(r'<meta name=description content="([^"]*)"', html)
    h1 = len(re.findall(r"<h1[^>]*>", html))
    return {
        "url": url,
        "status": status,
        "canonical": canon,
        "robots": robots,
        "title": text(r"<title>(.*?)</title>", html),
        "desc": desc,
        "desc_len": len(desc) if desc else 0,
        "h1": h1,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="OrzMC 官网 GEO/SEO 审计")
    ap.add_argument("--base-url", default="https://orzmc.jokerhub.cn")
    ap.add_argument("--jobs", type=int, default=8)
    ap.add_argument("--max-desc", type=int, default=160)
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    ts = str(int(time.time()))
    errors: list[str] = []
    warnings: list[str] = []

    # 1) sitemap / llms / robots
    try:
        _, _, sitemap = fetch(f"{base}/sitemap.xml?seo_audit={ts}")
        urls = re.findall(r"<loc>(.*?)</loc>", sitemap)
    except Exception as exc:  # noqa: BLE001
        print(f"[error] sitemap 不可用：{exc}", file=sys.stderr)
        return 1
    if not urls:
        errors.append("sitemap 为空或无法解析 <loc>")
    try:
        _, _, llms = fetch(f"{base}/llms.txt?seo_audit={ts}")
        if not llms.startswith("# "):
            warnings.append("llms.txt 缺少 H1 标题")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"llms.txt 不可访问：{exc}")
    try:
        _, _, robots = fetch(f"{base}/robots.txt?seo_audit={ts}")
        if "Sitemap:" not in robots:
            warnings.append("robots.txt 未声明 Sitemap")
        if "GPTBot" not in robots:
            warnings.append("robots.txt 未显式放行 GPTBot（AI 爬虫）")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"robots.txt 不可访问：{exc}")

    # 2) 页面
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as ex:
        pages = list(ex.map(lambda u: audit_page(u, ts, args.max_desc), urls))

    for p in pages:
        if p.get("error"):
            errors.append(f"{p['url']}: {p['error']}")
            continue
        if p["status"] != 200:
            errors.append(f"{p['url']}: HTTP {p['status']}")
        if p["canonical"] and p["canonical"].rstrip("/") != strip_query(p["url"]).rstrip("/"):
            errors.append(f"{p['url']}: canonical 指向 {p['canonical']}")
        if p["robots"] and "noindex" in p["robots"]:
            errors.append(f"{p['url']}: noindex")
        if not p["title"]:
            errors.append(f"{p['url']}: 缺 title")
        if not p["desc"]:
            errors.append(f"{p['url']}: 缺 description")
        elif p["desc_len"] < MIN_DESC:
            errors.append(f"{p['url']}: description 过短（{p['desc_len']} 字）")
        elif p["desc_len"] > args.max_desc:
            warnings.append(f"{p['url']}: description 过长（{p['desc_len']} 字）")
        if not p["h1"]:
            errors.append(f"{p['url']}: 缺 H1")

    titles = Counter(p["title"] for p in pages if p.get("title"))
    descs = Counter(p["desc"] for p in pages if p.get("desc"))
    for title, n in titles.items():
        if n > 1:
            errors.append(f"重复 title（{n} 次）：{title}")
    for desc, n in descs.items():
        if n > 1:
            warnings.append(f"重复 description（{n} 次）：{desc[:60]}…")

    for w in warnings:
        print(f"[warn] {w}", file=sys.stderr)
    for e in errors:
        print(f"[error] {e}", file=sys.stderr)
    print(
        f"审计完成：{len(pages)} 个 URL，{len(errors)} 个错误，{len(warnings)} 个警告"
        f"（sitemap {len(urls)} 条）"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
