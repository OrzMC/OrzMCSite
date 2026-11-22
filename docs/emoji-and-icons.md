# Emoji 统一渲染

> **状态**：已上线（2026-11-22）
> **最后更新**：2026-11-22（切换为 Apple 位图源）
> **相关文件**：`scripts/emoji_assets.py`、`data/emoji_map.yaml`、`assets/emoji/`、
> `layouts/partials/func/emoji.html`、
> `layouts/partials/server-status.html` + `static/js/server-status.js`

## 1. 为什么

emoji 只是文本字符，字形由**操作系统字体**提供：macOS 用 Apple Color Emoji、Windows 用
Segoe UI Emoji、Linux 用 Noto Color Emoji。同一篇文章在三个平台上是三套画风，而且：

| 字符 | 问题 |
|---|---|
| `🇨🇳`（区域指示符） | **Windows 不显示国旗**，显示灰底字母 `CN`；而它原先在 `site.Title` 里，全站导航/`<title>` 都受影响 |
| `🩷`（U+1FA77，Emoji 15.0） | Windows 10 / 旧 Android **显示豆腐块**（曾用作首页「玩家支持」面板图标） |
| `⚠` `☁` `⚡` `⚰`（text-presentation 默认） | 有无 `U+FE0F` 会渲染成单色小字或彩色大图，同一页里大小不一 |
| `❤️‍🔥`（ZWJ 序列） | 旧系统会拆成 `❤️` + `🔥` 两个字形 |
| 全部 | 字形宽高/行高由字体决定 → 表格行高、卡片行高、圆形色点直径在各平台不一致；暗色模式下 emoji 亮度不可调 |

## 2. 机制（一张图）

```
content/*.md  里照常写 emoji 字符
        │
        │  data/emoji_map.yaml（字符 → SVG 文件名，按字符数降序）
        ▼
layouts/partials/func/emoji.html     ── 先摘出 <script>/<pre>/<code> 段
        │                                再逐条做字面量替换
        ▼
<picture><source srcset="/emoji/2705_hu<指纹>.webp" type="image/webp">
  <img class="emoji" src="/emoji/2705_hu<指纹>.png" alt="&#x2705;" width="32" height="32"></picture>
        │
        ▼
assets/ananke/css/custom.css  .emoji { width:1em; height:1em; vertical-align:-0.125em }
```

- **资产**：`assets/emoji/`，只下载当前内容真正用到的（35 个）。Hugo 资产管线输出带指纹的 URL，
  浏览器长期缓存。图形源可切换（见 §7），**默认 Apple 160px PNG**：构建期缩成 128px 的
  webp（约 5 KB/张）+ png（约 15 KB/张）两档，用 `<picture>` 让现代浏览器走 webp；
  全站 webp 合计约 172 KB，首页实际加载约 26 KB。
- **映射**：`data/emoji_map.yaml` 是生成物，**顺序即替换顺序**（字符数降序，保证 `❤️‍🔥`
  先于 `❤️` 命中）。不要手改。
- **alt**：写 HTML 实体（`&#x2705;`）而不是原字符。这样读屏与「复制图片」仍然得到原 emoji，
  而字符串层面不含 emoji 字符 → 替换循环不会二次命中（否则 `❤️` 会命中 `❤️‍🔥` 的 alt）。
- **尺寸**：`1em` 跟随字号，标题/正文/表格自适应。

## 3. 内容作者怎么用

**直接写 emoji 字符，什么都不用做。**

```markdown
| 文件 | Overworld | Nether |
|------|-----------|--------|
| `world_gen_settings.dat` | ✅ | ✅ |
```

写了一篇新文章、用了**新的** emoji 时，CI 的 `emoji_assets.py check` 会失败并列出缺哪些，本地跑：

```bash
python3 scripts/emoji_assets.py sync                  # 按当前激活源补齐 + 重建映射表
python3 scripts/emoji_assets.py sync --source apple   # 切到 Apple 位图（默认）
python3 scripts/emoji_assets.py sync --source twemoji # 切回 Twemoji（CC-BY 4.0）
```

其余命令：

```bash
python3 scripts/emoji_assets.py check   # CI 同款校验（内容里的 emoji 是否都有本地资产）
python3 scripts/emoji_assets.py list    # 打印当前用到的 emoji 清单（三分类用）
python3 scripts/emoji_assets.py gen     # 只重建映射表（资产没变时不必要）
```

## 4. 模板接入点（新增渲染位置时照抄）

只对**可见输出**调用 `partial "func/emoji"`：

| 位置 | 文件 |
|---|---|
| 正文 | `layouts/_default/single.html`、`layouts/index.html`、`layouts/posts/list.html`、`layouts/taxonomy.html`、`layouts/terms.html` |
| 摘要卡片 | `layouts/posts/summary.html`、`layouts/posts/summary-home.html` |
| 正文标题（H2–H6） | `layouts/_default/_markup/render-heading.html`（`.Text`） |
| 目录 | `layouts/partials/toc.html`（`$page.TableOfContents` 是独立字符串，必须单独跑） |
| 页面标题（hero / 正文 h1） | `layouts/partials/site-header.html`、`layouts/_default/single.html` |
| 服务器卡片标题 + Tab | `layouts/partials/server-status.html` 生成 `name_html` 字段，`static/js/server-status.js` 用 `innerHTML` 渲染 |

**不要**接入的位置：`og:*` / `twitter:*` / `JSON-LD` / `RSS` / `llms.txt` / `baseof.html` 的
`<meta name="description">` —— 这些是纯文本通道，塞 `<img>` 只会变成字符串垃圾。
`<title>` 与社交卡片里的 emoji 由**平台自己渲染**（浏览器标签页、搜索结果、聊天软件预览），
不在站点控制范围内。

## 5. 特殊位置

- **站点标题**：`hugo.toml` 的 `title = "OrzMC"`（**纯文本，不带 emoji**）。
  `<title>`（浏览器标签页）、`og:*`、JSON-LD、RSS、`llms.txt` 都是纯文本通道，里面的 emoji
  只能由平台字体渲染 —— 国旗 `🇨🇳` 在 Windows 上会显示成 `CN` 字母，**标签页永远无法跨平台一致**。
  所以品牌标记与装饰标记只在**页面内**渲染：
  - `params.toml` 的 `brand_mark`（默认 `🇨🇳`）→ 导航、页脚版权，经 `partial "func/emoji"`；
  - 页面 frontmatter 的 `hero_mark`（如首页 `❤️‍🔥`）→ 只加在 hero/正文标题前，不进 `<title>`。
- **纯文本通道里的 emoji**：RSS 正文、`<title>`、社交预览 —— 由平台渲染，站点不控制，属于已知边界。
- **`<code>` / `<pre>`**：替换前整段摘出，代码示例里的 emoji 保持原字符。
- **server-status 配置 JSON**：在 `<script type="application/json">` 里，同样被摘出保护；
  服务器名另走 `name_html`（服务端预渲染成 `<img>`），由 JS 用 `innerHTML` 渲染。
- **服务器 MOTD**：来自服务器实时数据、经 `sanitizeMotdHtml` 清洗后由 JS 渲染，
  **不**经过这套管线（玩家在 MOTD 里放 emoji 仍由系统字体渲染）。
- **箭头 / `⌘`**：`← ↑ → ↓ ⌘` 等不是 emoji，Twemoji 也不提供，保持原字符
  （各平台差异极小）。名单在 `scripts/emoji_assets.py` 的 `EXEMPT`。

## 6. 校验

> 前置：需要 Hugo **≥ 0.156**（模板用 `hugo.Data`；`site.Data` 已 deprecated）。CI 固定 0.165.0。

CI（`.github/workflows/site_deploy.yml`）在 `check_content.py` 之后跑
`python3 scripts/emoji_assets.py check`，阻断「内容里有 emoji 但没有本地资产」的情况
——否则线上会静默退回系统字体渲染。

本地完整验证：

```bash
python3 scripts/emoji_assets.py check
hugo -e production --minify --gc -d /tmp/pub-test
grep -ro 'class=emoji' /tmp/pub-test | wc -l        # 应为数百处
# 残留裸 emoji 只应出现在 <title>/og/twitter meta、server-status JSON、RSS
```

## 7. 图形源与权利归属

| `--source` | 图形 | 与 macOS 一致性 | 许可 / 权利 |
|---|---|---|---|
| `apple`（默认） | Apple Color Emoji 160px PNG（`iamcal/emoji-data`） | **逐字形一致** | 图形著作权归 **Apple Inc.**；macOS 字体许可不允许提取再分发，本站为非商业展示用途，署名与异议处理见 `/licenses/` |
| `twemoji` | Twemoji SVG（`jdecked/twemoji`） | 风格不同（扁平），尺寸/基线一致 | **CC-BY 4.0**，完全合规 |

切换只需 `sync --source <源>` + 重新构建：`data/emoji_map.yaml` 头部记录 `# source:`，
模板（`func/emoji.html`）按文件扩展名自动选 `<picture>` 或 `<img>`。
切换时 `sync` 会清掉另一种格式的旧资产，避免同名 stem 两种扩展名共存。

## 8. 已知边界与后续可选项

- `<title>`、og/twitter 预览、RSS 里的 emoji 仍是字符（平台渲染）——超出站点控制范围。
- 图形是位图/固定配色，暗色模式下不能像内联 SVG 那样用 `currentColor` 调色。
  目前只对锚点图标（`🔗`）加了一档 `brightness` 提亮（`custom.css`）。
- 如果想进一步提升**可读性/无障碍**（读屏把 `✅` 念成 "white heavy check mark"），可以把
  `✅/❌/⚠` 换成「图标 + 文字」的语义徽章（shortcode）。这是内容层重构（约 139 处），
  与当前管线不冲突（徽章不输出 emoji 字符，替换不会命中），可作为后续增量。
- 新增 emoji 时若该源没有对应图形（极新的 emoji），`sync` 会提示并保持系统渲染。
