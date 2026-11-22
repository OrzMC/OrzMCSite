#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""emoji 资产与映射表管理：让站点自己提供 emoji 图形，不依赖系统 emoji 字体。

背景：正文/模板里的 emoji 字符由操作系统字体绘制（Apple / Segoe UI Emoji / Noto），
不同平台字形、尺寸、行高、色彩都不同（Windows 上国旗显示成 "CN"、新 emoji 显示豆腐块）。
本脚本把用到的 emoji 统一映射到**自托管图形**，由 layouts/partials/func/emoji.html
在构建期把字符替换成 <img class="emoji">，从而多平台一致。

图形源（--source，默认读取已激活的源）：
  apple     Apple 160px PNG（iamcal/emoji-data）。逐字形与 macOS 原生一致。
            ⚠️ 图形著作权属 Apple；macOS 字体许可不允许提取再分发，公开站点属灰色地带，
            由维护者判断（见 content/licenses.md 的署名与说明）。
  twemoji   Twemoji SVG（jdecked/twemoji，CC-BY 4.0）。完全合规，扁平风格。

用法:
  python3 scripts/emoji_assets.py check              # 校验（CI 阻断）：内容里的 emoji 是否都有本地资产
  python3 scripts/emoji_assets.py sync               # 按当前激活源补齐缺失资产 + 重建映射表
  python3 scripts/emoji_assets.py sync --source apple  # 切到 Apple 位图（会清掉另一格式的资产）
  python3 scripts/emoji_assets.py sync --source twemoji --offline
  python3 scripts/emoji_assets.py gen                # 只从 assets/emoji/ 重建 data/emoji_map.yaml
  python3 scripts/emoji_assets.py list               # 打印当前扫描到的 emoji 清单

约定:
  · assets/emoji/<stem>.<ext> —— filename stem 为 Unicode 码位（小写十六进制、`-` 连接），
    Apple 源对需要 VS16 的字符用 `<stem>-fe0f`（emoji-data 的原始命名，原样保留）
  · data/emoji_map.yaml —— 生成物，按字符长度降序（模板据此「先长后短」替换，避免
    ZWJ 序列被单颗心抢先命中）；文件头的 `# source:` 记录当前激活源
  · 代码块/行内代码里的 emoji 不会替换（模板会摘出 <pre>/<code>），check 仍会列出提醒
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMOJI_DIR = ROOT / "assets" / "emoji"
MAP_FILE = ROOT / "data" / "emoji_map.yaml"

SOURCES = {
    "apple": {
        "ext": ".png",
        "raw": "https://raw.githubusercontent.com/iamcal/emoji-data/master/img-apple-160/",
        # Apple 源：emoji-data 对「需要 VS16 的字符」用 `<stem>-fe0f` 命名，
        # 所以候选顺序把 `<stem>-fe0f` 排第二（先试不带、再试带、最后试原本带 VS16 的序列）。
        "cands": "apple",
        "desc": "Apple 160px PNG（iamcal/emoji-data）",
    },
    "twemoji": {
        "ext": ".svg",
        "raw": "https://raw.githubusercontent.com/jdecked/twemoji/main/assets/svg/",
        "cands": "twemoji",
        "desc": "Twemoji SVG（jdecked/twemoji，CC-BY 4.0）",
    },
}
DEFAULT_SOURCE = "apple"

TREE_CACHE = Path("/tmp/twemoji-tree.json")

# 扫描范围（站点可发布内容 + 模板 + 配置）
SCAN_DIRS = ["content", "layouts", "config", "assets", "static", "i18n", "archetypes"]
SCAN_EXTS = {".md", ".html", ".toml", ".yaml", ".yml", ".js", ".txt"}

# 非 emoji 的技术符号（箭头、⌘ 等）：各源都不提供，各平台也无实质差异，保持原字符。
EXEMPT = set("←↑→↓↔↕⇧⌘⌥⇪⏎")

EMOJI_RANGES = [
    (0x1F000, 0x1FAFF),  # 图形 emoji（含肤色、区域指示符）
    (0x2600, 0x27BF),    # 杂项符号 / Dingbats（☁ ⚠ ✅ ❌ ❤ ...）
    (0x2B00, 0x2BFF),    # ⬛ ⭐ 等
    (0x2300, 0x23FF),    # ⌘ ⏰ 等（多数已在 EXEMPT）
    (0x2190, 0x21FF),    # 箭头（EXEMPT）
]
VS = {0xFE0F, 0xFE0E}
MOD = range(0x1F3FB, 0x1F400)  # 肤色修饰
ZWJ = 0x200D
VS16 = "\ufe0f"


def is_base(cp: int) -> bool:
    return any(a <= cp <= b for a, b in EMOJI_RANGES)


def sequences(text: str):
    """把文本切成 emoji 序列（正确处理 ZWJ 连接、变体选择符、肤色、区域指示符对）。"""
    out, i, n = [], 0, len(text)
    while i < n:
        cp = ord(text[i])
        if 0x1F1E6 <= cp <= 0x1F1FF and i + 1 < n and 0x1F1E6 <= ord(text[i + 1]) <= 0x1F1FF:
            out.append(text[i : i + 2])
            i += 2
            continue
        if not is_base(cp):
            i += 1
            continue
        j = i + 1
        while j < n:
            c = ord(text[j])
            if c in VS or c in MOD or c == 0x20E3:
                j += 1
                continue
            if c == ZWJ and j + 1 < n and is_base(ord(text[j + 1])):
                j += 2
                continue
            break
        out.append(text[i:j])
        i = j
    return out


def codepoint_stems(seq: str) -> list[str]:
    """基础候选 stem：去 VS16 优先，其次保留 VS16。"""
    cps = [ord(c) for c in seq]
    no_vs = "-".join(f"{c:x}" for c in cps if c not in VS)
    with_vs = "-".join(f"{c:x}" for c in cps)
    return [no_vs] if no_vs == with_vs else [no_vs, with_vs]


def cand_stems(seq: str, source: str) -> list[str]:
    """按源的命名习惯给出候选 stem（按尝试顺序去重）。"""
    base = codepoint_stems(seq)
    if SOURCES[source]["cands"] == "apple":
        out = []
        for stem in base:
            out.append(stem)
            if not stem.endswith("-fe0f"):
                out.append(stem + "-fe0f")
        return list(dict.fromkeys(out))
    return base


def html_entities(seq: str) -> str:
    """字符 → HTML 实体串，写进 <img alt>：读屏与复制粘贴仍得到原 emoji，
    而字符串层面不含 emoji 字符，避免替换循环二次命中。"""
    return "".join(f"&#x{ord(c):x};" for c in seq)


def char_from_stem(stem: str) -> str:
    return "".join(chr(int(part, 16)) for part in stem.split("-"))


# ---------------------------------------------------------------- 扫描 / 数据


def scan() -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for rel in SCAN_DIRS:
        base = ROOT / rel
        if not base.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in {"themes", "node_modules", "public"}]
            for name in filenames:
                if Path(name).suffix.lower() not in SCAN_EXTS:
                    continue
                path = Path(dirpath) / name
                try:
                    text = path.read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue
                for seq in sequences(text):
                    if seq in EXEMPT:
                        continue
                    found.setdefault(seq, set()).add(str(path.relative_to(ROOT)))
    return found


def local_assets() -> dict[str, str]:
    """stem -> 文件名（含扩展名）。同一 stem 只保留当前源格式。"""
    out: dict[str, str] = {}
    if not EMOJI_DIR.is_dir():
        return out
    for p in sorted(list(EMOJI_DIR.glob("*.svg")) + list(EMOJI_DIR.glob("*.png"))):
        out[p.stem] = p.name
    return out


def active_source() -> str:
    """当前激活源：读 data/emoji_map.yaml 文件头的 `# source:`。"""
    if MAP_FILE.exists():
        for line in MAP_FILE.read_text(encoding="utf-8").splitlines()[:8]:
            m = re.match(r"# source: (\w+)", line)
            if m and m.group(1) in SOURCES:
                return m.group(1)
    return DEFAULT_SOURCE


def twemoji_index(offline: bool = False) -> set[str]:
    """远端 Twemoji 文件名集合（仅 twemoji 源需要）。"""
    if TREE_CACHE.exists():
        try:
            tree = json.loads(TREE_CACHE.read_text(encoding="utf-8"))
            return {
                p.split("/")[-1][:-4]
                for p in (t["path"] for t in tree["tree"])
                if p.startswith("assets/svg/") and p.endswith(".svg")
            }
        except (json.JSONDecodeError, KeyError):
            pass
    if offline:
        sys.exit("没有远端索引缓存，无法离线 sync（先联网跑一次）")
    url = "https://api.github.com/repos/jdecked/twemoji/git/trees/main?recursive=1"
    print(f"[emoji] 拉取 Twemoji 文件索引 {url}", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=120) as resp:
        raw = resp.read()
    TREE_CACHE.write_bytes(raw)
    tree = json.loads(raw)
    return {
        p.split("/")[-1][:-4]
        for p in (t["path"] for t in tree["tree"])
        if p.startswith("assets/svg/") and p.endswith(".svg")
    }


def yaml_quote(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def map_entries(char: str, filename: str) -> list[str]:
    """一个资产对应哪些「正文里可能出现的写法」：原样 + 带/去 VS16 的变体。"""
    keys = [char]
    if VS16 in char:
        keys.append(char.replace(VS16, ""))
    elif len(char) == 1 and is_base(ord(char)) and not (0x1F1E6 <= ord(char) <= 0x1F1FF):
        keys.append(char + VS16)
    return list(dict.fromkeys(keys))


def write_map(source: str, entries: list[tuple[str, str]]) -> None:
    """entries: [(emoji 字符, 资产文件名)]，按字符数降序（模板按此顺序替换）。"""
    entries = sorted(entries, key=lambda kv: (-len(kv[0]), kv[0]))
    lines = [
        "# 由 scripts/emoji_assets.py 生成，请勿手改。",
        f"# source: {source} —— {SOURCES[source]['desc']}",
        "# 用途：layouts/partials/func/emoji.html 构建期把 emoji 字符替换为自托管图形。",
        "# 顺序：字符数降序 —— 模板按顺序做字面量替换，保证 ZWJ 序列先于单颗心命中。",
        "",
    ]
    for char, file in entries:
        name = unicodedata.name(char[0], "?")
        lines.append(f"# {name}")
        lines.append(f"- char: {yaml_quote(char)}")
        lines.append(f"  file: {file}")
        lines.append(f'  alt: "{html_entities(char)}"')
    MAP_FILE.parent.mkdir(parents=True, exist_ok=True)
    MAP_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[emoji] 写入 {MAP_FILE.relative_to(ROOT)}（{len(entries)} 条，source={source}）")


# ---------------------------------------------------------------- 命令


def cmd_gen(args) -> int:
    """从 assets/emoji/ 生成映射表（源的格式由目录里的文件决定）。"""
    assets = local_assets()
    if not assets:
        sys.exit("assets/emoji/ 为空，先跑 sync")
    source = args.source or active_source()
    entries: dict[str, str] = {}
    for stem, filename in assets.items():
        for key in map_entries(char_from_stem(stem), filename):
            entries.setdefault(key, filename)
    write_map(source, list(entries.items()))
    return 0


def cmd_check(_args) -> int:
    """CI 护栏：内容里出现的 emoji 必须在映射表里（否则线上仍是系统渲染）。"""
    found = scan()
    if not MAP_FILE.exists():
        print(f"[emoji] 缺少 {MAP_FILE.relative_to(ROOT)}，先跑 gen", file=sys.stderr)
        return 1
    mapped = set()
    for line in MAP_FILE.read_text(encoding="utf-8").splitlines():
        m = re.match(r'- char: "(.*)"\s*$', line)
        if m:
            mapped.add(m.group(1).replace('\\"', '"').replace("\\\\", "\\"))
    missing = {seq: where for seq, where in found.items() if seq not in mapped}
    if missing:
        print("[emoji] 以下 emoji 没有本地资产/映射条目（会退回系统字体渲染）：", file=sys.stderr)
        for seq, where in sorted(missing.items()):
            name = unicodedata.name(seq[0], "?")
            files = ", ".join(sorted(where)[:3])
            print(f"  {seq}  U+{ord(seq[0]):04X}  {name}  ← {files}", file=sys.stderr)
        print("\n修复：python3 scripts/emoji_assets.py sync", file=sys.stderr)
        return 1
    print(f"[emoji] OK：{len(found)} 种 emoji 全部有本地资产（映射表 {len(mapped)} 条，source={active_source()}）")
    return 0


def cmd_list(_args) -> int:
    found = scan()
    for seq, where in sorted(found.items(), key=lambda kv: (-len(kv[0]), kv[0])):
        name = unicodedata.name(seq[0], "?")
        print(f"{seq}  U+{','.join(f'{ord(c):04X}' for c in seq)}  {name}  x{len(where)}  {sorted(where)[0]}")
    print(f"\n共 {len(found)} 种")
    return 0


def cmd_sync(args) -> int:
    """按指定源补齐缺失资产（会清掉另一种格式的旧文件），然后重建映射表。"""
    source = args.source or active_source()
    spec = SOURCES[source]
    ext = spec["ext"]
    EMOJI_DIR.mkdir(parents=True, exist_ok=True)

    # 切换源时清掉另一种格式，避免同名 stem 一个目录两种文件让 gen 混乱
    stale = [p for p in EMOJI_DIR.glob("*" + (".svg" if ext == ".png" else ".png"))]
    for p in stale:
        p.unlink()
    if stale:
        print(f"[emoji] 清理 {len(stale)} 个非当前源格式的资产", file=sys.stderr)

    found = scan()
    have = local_assets()
    index = twemoji_index(getattr(args, "offline", False)) if source == "twemoji" else None
    added, missing = 0, []
    for seq in sorted(found, key=lambda s: (-len(s), s)):
        cands = cand_stems(seq, source)
        # 本地已有任一候选直接跳过
        if any(c + ext in have.values() for c in cands):
            continue
        for stem in cands:
            if index is not None and stem not in index:
                continue
            url = spec["raw"] + stem + ext
            try:
                with urllib.request.urlopen(url, timeout=60) as resp:
                    data = resp.read()
            except urllib.error.HTTPError:
                continue
            print(f"[emoji] 下载 {stem}{ext}  ← {seq}", file=sys.stderr)
            (EMOJI_DIR / f"{stem}{ext}").write_bytes(data)
            added += 1
            break
        else:
            missing.append(seq)
    if added:
        print(f"[emoji] 新增 {added} 个资产（source={source}）")
    if missing:
        print("[emoji] 该源无对应图形（保持系统渲染）：" + " ".join(missing), file=sys.stderr)
    args.source = source
    return cmd_gen(args)


def main() -> int:
    ap = argparse.ArgumentParser(description="emoji 资产与映射表管理")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("check", cmd_check), ("gen", cmd_gen), ("list", cmd_list), ("sync", cmd_sync)):
        p = sub.add_parser(name)
        p.set_defaults(fn=fn, source=None)
        if name in ("sync", "gen"):
            p.add_argument("--source", choices=sorted(SOURCES), default=None,
                           help="图形源（默认沿用已激活的源）")
        if name == "sync":
            p.add_argument("--offline", action="store_true", help="twemoji 源只用本地索引缓存")
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
