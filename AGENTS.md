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
- **Hugo 内置模板覆盖**（项目 `layouts/partials/`）：`opengraph.html`、`twitter_cards.html`、`schema.html`（JSON-LD）、`site-favicon.html`、`head-additions.html`（preconnect/manifest/theme-color/busuanzi 脚本、首页 hero preload）、`site-header.html`（hero 响应式 `<picture>`，含 `fetchpriority="high"`，档位来自 `func/hero-variants.html`）、`site-footer.html`（页脚，含不蒜子访问统计行 PV+UV）。`head-additions.html` 必须保留 `head-end` hook 调用；`site-header.html` 的 `else` 分支必须保留主题无 featured_image 写法。统计容器默认 `.dn` 隐藏、busuanzi 成功时 inline display 覆盖显示，改动时勿破坏此降级机制（详见记忆）。
- **server-status 组件**：完全 shortcode 驱动（`{{< server-status >}}`，带 refresh/columns/servers 参数）。单一数据源是 `config/_default/params.toml` 的 `[server_status]`（服务器列表 + info_panels）。地址密文通过 JS 运行时解码的加密替换表生成，构建产物不含明文——新增/修改服务器只改 params.toml，别动 `server-status.js` 里的数据。
- **SEO 层**：og:image 解析链路在 `func/get-og-image.html`（优先级 `images[0]` → `featured_image` → `default_og_image`；命中 `assets/images/` 资源时输出构建期生成的 **≤1280px PNG 档**而非原始母版，避免几 MB 原图被发布上线供社交爬虫抓取）；面包屑数据在 `func/breadcrumbs.html`（与可见面包屑同源）；JSON-LD 的 `dateModified` 由 `enableGitInfo` 从 git 派生，文章 `date` 取自 git 首次提交日期，**不编造日期**。
- **图片约定（用户明确要求）**：
  - **featured_image 全站统一走 `assets/images/` 构建期管线（零手工）**：源图放 `assets/images/`（页面级 hero 放根目录、文章封面放 `posts/` 子目录），页面/文章 frontmatter 写 `featured_image: "/images/<相对 assets 的路径>"` 即可。`func/hero-variants.html` 在编译期解码源宽、按「标准档位 ≤ 源宽」规则自动生成变体（webp q90 / png 兜底 / 非标准源宽补原生宽最高档），`site-header.html` 渲染 `<picture>`（默认 **fit 等比全宽展示**：全宽图按源图比例显示不裁不拉伸（主体任何视口完整可见，sizes=100vw），**≥60em（导航单行）**：图等比全宽展示不裁不拉伸；导航悬浮图顶（渐变遮罩），标题水平垂直居中悬浮。**<60em（导航折行）**：导航仍悬浮图顶；图改 cover + 左对齐（右侧可裁，素材主体靠左构图），hero 高 clamp(360px,72vh,560px) 兜底，标题悬浮图内左下角左对齐（max-width 收窄）——悬浮层与折行导航不重叠。）、`head-additions.html` 在首页输出同源 `imagesrcset` preload、og/twitter/schema 引用带指纹的发布产物。页面 frontmatter 可设 `hero_display: "cover"` 回退旧全出血裁切海报模式（标题压图，sizes 分段抬档）。**换图 = 覆盖 assets 下的源文件**，禁止对源图做超采样的 2560/3840 假档；手工预生成变体与 `[featured_image_widths]` 登记已废弃。
  - 现有页面级 hero 源：`minecraft_night.png`（3840×1712，**唯一源文件**，首页/赞助页共用，禁止直接压缩/降质，清晰度优先）、`minecraft_client.png`（1672×941）、`minecraft_user.png`/`minecraft_plugin.png`（1671×941，client/user/plugin 页各一）。文章封面源放 `assets/images/posts/`，建议统一 16:9、宽 ≥1280、PNG/JPG/WebP ≤2MB。
  - **作者模板与尺寸自查（复制即用）**——文章想显示头图时，frontmatter 加 `featured_image` 一行即可：
    ```
    ---
    title: "文章标题"
    summary: "一句话摘要（列表卡片显示）"
    weight: 12          # 数值编号，与文件名 <编号>.<slug> 保持一致
    tags: ["标签A", "标签B"]
    categories: ["客户端"]   # 与分类目录一致：客户端 / 服务端 / 其他
    featured_image: "/images/posts/12.<slug>.png"   # ← 可选；图放 assets/images/posts/，见下
    # date 勿手填：文章日期取自 git 首次提交日期
    ---
    ```
    尺寸自查（放图前过一遍，5 秒）：
    - [ ] 文件放在 **`assets/images/posts/`**（不是 static/，也不用自己生成任何变体）
    - [ ] 宽度 **≥1280px**（社交分享图需 ≥1200；建议 1600–1920，最高 3840 已足够）
    - [ ] 比例 **16:9 左右**；构图主体居中——顶部约 1/4 会被导航栏与标题暗层遮挡、超宽/过窄的边缘会被 cover 裁掉
    - [ ] PNG/JPG/WebP、**≤2MB**、sRGB
    - [ ] frontmatter 路径与文件名**完全一致**（`/images/posts/` + 文件名，含扩展名）
    - [ ] `./preview` 目测头图；换图 = 覆盖同名文件后重新构建（产物带指纹，URL 自动更新）
    > 忘记放文件或路径写错不会构建失败：页面自动回退纯黑 header，检查 frontmatter 拼写与文件是否存在即可。
  - **cover 模式的 `sizes` 分段抬档（仅 `hero_display: "cover"` 时生效；fit 默认恒为 `100vw`，勿改回 cover 段位）**：手机 hero 是竖容器，`object-fit: cover` 按高填满导致图被横向放大 ~2.7x，`sizes=100vw` 的朴素选档会欠采样发糊（实测 390×3 需 ~3159px、1280 档欠采样 2.47x）。故 `sizes="(min-width:60em) 100vw, (min-width:48em) 120vw, 180vw"`：手机(<48em)用 180vw 按 DPR 抬档（DPR2→1920w、DPR3→2560w），平板(48-60em)120vw 防过载，桌面(≥60em)1:1 保持 100vw。**2560 档**同时兜住 DPR1.25–1.5 笔记本与 2K 屏（缺它这些屏会直跳 3840w 白掏流量，2K 屏 3840→2560 流量减半且无损）。png 1280 档是 `<picture>` 不支持的旧浏览器 `<img>` 兜底（构建期生成）。3840 档是 Retina 桌面 2x 兜底。质量目标等同 q90+lanczos（PSNR 38.8→43.7dB 水平），**勿降回低质量**。
  - favicon 必须保持原 `static/images/favicon.png`，不要用自绘 SVG 替代；
  - 分享图 `static/images/og-default.png` 是 hero 图 1200×630 中心裁剪版（`ffmpeg -vf "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630"`），不加载 hero 全分辨率原图；首页/赞助页 frontmatter 的 `images` 指向它（og 优先 `images[0]`）。
- **Hugo 函数风格**：项目用新命名空间函数（`compare.Default`、`collections.Slice/Append`、`partials.Include`、`fmt.Printf`、`safe.HTMLAttr`），新代码保持一致，不用旧风格。注意：本 Hugo 版本 `strings.TrimPrefix`/`strings.TrimSuffix` 参数序是 **（prefix/suffix, s）**——去前导斜杠写 `strings.TrimPrefix "/" $s`，写反会得到空/根路径（如 `resources.Get` 命中 assets 根目录）。
- **部署**：push main → GitHub Actions `site_deploy.yml` → `./deploy` 构建并发布 gh-pages。GitHub Pages CDN 有 `max-age=600` 缓存，部署后需等 CDN 刷新或用 raw.githubusercontent.com 的 gh-pages 分支确认产物。

## 工具坑

- `sips` 重编码 PNG 会膨胀；图片缩放/裁剪用 `ffmpeg`。`rsvg-convert` 可渲染中文 SVG→PNG。
- **本机 ffmpeg（8.x）编译时未含 `libwebp` 编码器**，且 `brew install webp` 可能网络超时。hero 变体已由 Hugo 构建期自动生成（不需要手工 webp）；一次性转换（分享图 1200×630 裁剪、正文图压 webp/缩图）可用 ffmpeg（缩放/裁剪）或系统 python3 + Pillow（webp：`Image.LANCZOS` + `WEBP quality=90`）。
- `hugo --minify` 会剥 HTML 属性引号（`type="application/ld+json"` → `type=application/ld+json`）、CSS 属性引号与缩进，但**含空格/括号等需转义的属性值会保留引号**（含空格值不会剥引号）。另注意：Hugo 对 `link[imagesrcset]` 等动作输出做 URL 上下文转义会把空格变 `%20`——head-additions 首页 preload 已用 `printf`+`safe.HTML` 规避；grep 验证 picture/preload/fetchpriority 等产物时用宽松 pattern（如 `grep -oE 'fetchpriority=[a-z]+'`、`grep -oE 'minecraft_night_[a-z0-9]+\.(webp|png)'`，构建期产物文件名为 `stem_hu_<hash>.webp` 带指纹）。
- 正文容器被 Ananke 包 `.nested-links`，Tachyons `.nested-links a{color:#357edd}` 特异性(0,1,1)会压过自定义 CSS 里的裸 `a`/`.sponsor-cta__btn`——想改正文链接/按钮颜色必须用 `html[data-theme="light"] .nested-links a…` 同容器提权（暗色靠 `html[data-theme="dark"] a`(0,1,2) 已覆盖）。
- TOML 带连字符的键（如 `site.Params.ananke.social.x-twitter`）必须用 `(index ... "x-twitter")` 访问，点号解析会失败。
- 本机 `cp` 被 alias 成交互模式，覆盖文件用 `command cp -f`。
- 移动端/响应式布局验证依赖容器查询，改动布局后需检查 `custom.css` 中 `@container` 规则与暗色模式覆盖。

## 内容结构

- 文章在 `content/posts/<分类>/<编号>.<slug>.md`，13 篇，frontmatter 含 `tags`/`categories`/`date`/`weight`（可选加 `featured_image` 显示文章头图，源图放 `assets/images/posts/`，见图片约定）。`content/posts/_index.md` 是归档页 frontmatter（不是文章）。
- 独立页：`content/_index.md`（主页，含 server-status）、`content/sponsor.md`、`content/user.md`、`content/client.md`、`content/plugin.md`。
- 主页文章列表在 `layouts/index.html`（双列网格 `posts-grid-home`），归档页在 `layouts/posts/list.html`。
