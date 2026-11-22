---
title: "第三方素材与许可"
description: "OrzMC 官网 emoji 图形与界面图标的来源、权利归属与异议处理方式。"
---

本站页面内的 emoji 不交给操作系统字体绘制（Windows 上国旗会显示成 "CN"、新 emoji 会显示豆腐块），
而是在构建期替换为站点自托管的图形。

## Emoji 图形

- **来源**：Apple Color Emoji 的 160px 位图，取自开源项目
  [`iamcal/emoji-data`](https://github.com/iamcal/emoji-data)。本站只收录实际用到的 35 个，
  构建期输出 128px 的 webp / png 两档。
- **权利归属**：这些图形著作权归 **Apple Inc.** 所有。本站为非商业社区站点，
  仅将其用于页面展示，不主张任何权利，也不以之获利。
- **异议处理**：若权利人或其代理认为此处使用不妥，请在
  [GitHub 组织](https://github.com/OrzMC) 联系我们，我们会立即移除并改用开源替代。
- **开源替代**：Twemoji（<https://github.com/jdecked/twemoji>，CC-BY 4.0），
  可用 `python3 scripts/emoji_assets.py sync --source twemoji` 一键切换。

## 其他

界面图标（刷新 / 复制 / 显隐地址 / 浏览器入口）来自 **Lucide**（<https://lucide.dev>，ISC）。
站点生成器 Hugo 与主题 Ananke 的许可见各自仓库。
