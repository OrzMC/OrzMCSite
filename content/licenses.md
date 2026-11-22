---
title: "第三方素材与许可"
description: "OrzMC 官网使用的第三方图形与代码素材清单（emoji 图形、图标、主题等）及其许可与署名。"
---

本站在构建期使用以下第三方素材。**emoji 图形由站点自托管**（不再交给操作系统字体渲染），
以保证 Windows / macOS / Linux / 移动端显示一致。

## Emoji 图形

本站的 emoji **不交给操作系统字体绘制**（Windows 上国旗会显示成 "CN"、新 emoji 会显示豆腐块），
而是在构建期替换为站点自托管的图形，以保证 Windows / macOS / Linux / 移动端显示一致。

- **图形来源**：Apple Color Emoji 的 160px 位图版本，取自开源项目
  [`iamcal/emoji-data`](https://github.com/iamcal/emoji-data)。本站只收录**实际用到**的
  35 个 emoji，构建期输出 128px 的 webp / png 两档。
- **权利归属**：这些**图形著作权归 Apple Inc.** 所有。本站为非商业的个人社区站点，
  仅将其用于页面展示，不主张任何权利，也不以之获利。
- **异议处理**：若权利人或其代理认为此处使用不妥，请在
  [GitHub 组织](https://github.com/OrzMC) 联系我们，我们会立即移除并改用开源替代
  （Twemoji，CC-BY 4.0）——站点已内置一键切换。
- **开源替代**：Twemoji <https://github.com/jdecked/twemoji>（CC-BY 4.0），
  可通过 `python3 scripts/emoji_assets.py sync --source twemoji` 切换。

## 界面图标

- **Lucide** —— 许可 **ISC**（<https://lucide.dev/license>）。用于服务器状态卡片上的
  刷新 / 复制 / 显隐地址 / 浏览器图标等界面图标（内联 SVG，随文字颜色变化）。

## 站点框架

- **Hugo**（静态站点生成器）—— Apache-2.0。
- **Ananke**（Hugo 主题，git submodule）—— MIT。

## 字体

本站不加载第三方 Web 字体，正文使用系统字体栈；emoji 走上述站点自托管图形，
因此**页面内**不存在跨平台的 emoji 字体差异（浏览器标签页与社交预览里的标题 emoji 仍由平台渲染）。

---

若有署名遗漏或版权疑问，请到 [GitHub 组织](https://github.com/OrzMC) 提出。
