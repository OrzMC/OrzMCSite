# AGENTS.md

本文件是 **OrzMC 项目的唯一事实来源**（single source of truth），供所有 AI 智能体读取：Claude Code、OpenAI Codex、Gemini CLI、GitHub Copilot、Cursor 及任何支持 AGENTS.md 标准的工具。在不同工具间切换时，项目认知保持一致，配置不漂移。

## 项目简介

OrzMC 私服官网：Hugo 静态站（Ananke 主题），中文 Minecraft 服务器社区站。内容为服务端运维/插件开发/客户端教程文章 + 服务器实时状态组件。部署到 GitHub Pages（自定义域 `https://orzmc.jokerhub.cn`）。

## 常用命令

```bash
./preview          # 本地预览（Hugo server；`./preview -h` 看参数，可用 stop 停服）
./deploy -n        # 生产构建 + dry-run 对比（不上传）
./deploy           # 生产构建 + 发布到 gh-pages 分支（CI push main 时自动执行，一般不需手动跑）
hugo -e production --minify --gc   # 等价生产构建到 public/（deploy 内部调用）
```

没有测试与 lint。`./rsync_publish` 是发布到本地/远程 Nginx 的备用路径，一般不用于线上。

## 架构与关键约定

- **`themes/ananke` 是 git submodule，绝不修改**。所有定制放项目 `layouts/`、`content/`、`static/`、`config/`、`assets/` 下。Ananke 用 `partials.IncludeCached`，项目 `layouts/partials/` 的同名文件优先于主题。
- **Hugo 内置模板覆盖**（项目 `layouts/partials/`）：`opengraph.html`、`twitter_cards.html`、`schema.html`（JSON-LD）、`site-favicon.html`、`head-additions.html`（preconnect/manifest/theme-color/busuanzi 脚本）、`site-footer.html`（页脚，含不蒜子访问统计行 PV+UV）。`head-additions.html` 必须保留 `head-end` hook 调用。统计容器默认 `.dn` 隐藏、busuanzi 成功时 inline display 覆盖显示，改动时勿破坏此降级机制（详见记忆）。
- **server-status 组件**：完全 shortcode 驱动（`{{< server-status >}}`，带 refresh/columns/servers 参数）。单一数据源是 `config/_default/params.toml` 的 `[server_status]`（服务器列表 + info_panels）。地址密文通过 JS 运行时解码的加密替换表生成，构建产物不含明文——新增/修改服务器只改 params.toml，别动 `server-status.js` 里的数据。
- **SEO 层**：og:image 解析链路在 `func/get-og-image.html`（优先级 `images[0]` → `featured_image` → `default_og_image`）；面包屑数据在 `func/breadcrumbs.html`（与可见面包屑同源）；JSON-LD 的 `dateModified` 由 `enableGitInfo` 从 git 派生，文章 `date` 取自 git 首次提交日期，**不编造日期**。
- **图片约定（用户明确要求）**：
  - hero 主图 `static/images/minecraft_night.png`（3840×1712）**禁止压缩/缩放**，清晰度优先；
  - favicon 必须保持原 `static/images/favicon.png`，不要用自绘 SVG 替代；
  - 分享图 `static/images/og-default.png` 是 hero 图 1200×630 中心裁剪版（`ffmpeg -vf "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630"`），不加载 hero 全分辨率原图。
- **Hugo 函数风格**：项目用新命名空间函数（`compare.Default`、`collections.Slice/Append`、`partials.Include`、`fmt.Printf`、`safe.HTMLAttr`），新代码保持一致，不用旧风格。
- **部署**：push main → GitHub Actions `site_deploy.yml` → `./deploy` 构建并发布 gh-pages。GitHub Pages CDN 有 `max-age=600` 缓存，部署后需等 CDN 刷新或用 raw.githubusercontent.com 的 gh-pages 分支确认产物。

## 工具坑

- `sips` 重编码 PNG 会膨胀；图片缩放/裁剪用 `ffmpeg`。`rsvg-convert` 可渲染中文 SVG→PNG。
- `hugo --minify` 会剥 HTML 属性引号（`type="application/ld+json"` → `type=application/ld+json`），grep 验证时用宽松 pattern。
- TOML 带连字符的键（如 `site.Params.ananke.social.x-twitter`）必须用 `(index ... "x-twitter")` 访问，点号解析会失败。
- 本机 `cp` 被 alias 成交互模式，覆盖文件用 `command cp -f`。
- 移动端/响应式布局验证依赖容器查询，改动布局后需检查 `custom.css` 中 `@container` 规则与暗色模式覆盖。

## 内容结构

- 文章在 `content/posts/<分类>/<编号>.<slug>.md`，13 篇，frontmatter 含 `tags`/`categories`/`date`/`weight`。`content/posts/_index.md` 是归档页 frontmatter（不是文章）。
- 独立页：`content/_index.md`（主页，含 server-status）、`content/sponsor.md`、`content/user.md`、`content/client.md`、`content/plugin.md`。
- 主页文章列表在 `layouts/index.html`（双列网格 `posts-grid-home`），归档页在 `layouts/posts/list.html`。
