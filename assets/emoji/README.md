# assets/emoji — 站点自托管的 emoji 图形

这里的图形用于统一各平台的 emoji 渲染（不依赖系统 emoji 字体），由
`scripts/emoji_assets.py sync` 按需下载，**不需要手工放置**。

- 文件名 = Unicode 码位（小写十六进制、`-` 连接），例：`2705.png`（✅）、
  `1f1e8-1f1f3.png`（🇨🇳）、`2764-fe0f-200d-1f525.png`（❤️‍🔥）。
- 只有**当前内容里真正用到**的 emoji 才会下载进来（35 个，PNG 约 690 KB；
  构建期输出 128px 的 webp + png，实际加载约 172 KB / 全站，首页约 26 KB）。
- 渲染管线：`data/emoji_map.yaml`（生成物）→ `layouts/partials/func/emoji.html`
  在构建期把字符替换成 `<picture>` / `<img class="emoji">`。

## 图形源（可切换）

| `--source` | 图形 | 许可/权利 | 说明 |
|---|---|---|---|
| `apple`（默认） | Apple Color Emoji 160px PNG，取自 `iamcal/emoji-data` | **著作权归 Apple Inc.**，本站仅用于页面展示 | 与 macOS 原生逐字形一致 |
| `twemoji` | Twemoji SVG（`jdecked/twemoji`） | CC-BY 4.0 | 完全合规，扁平风格 |

```bash
python3 scripts/emoji_assets.py sync --source apple     # 切到 Apple（默认）
python3 scripts/emoji_assets.py sync --source twemoji   # 切回 Twemoji（会清掉 png，重下 svg）
```

切换后重新构建即可，模板与映射表都自动跟随（`data/emoji_map.yaml` 头部记录 `# source:`）。

## 新增 emoji 的流程

内容里直接写 emoji 即可（作者无需知道这套机制）。写了**新的** emoji 时，CI 的
`emoji_assets.py check` 会失败并列出缺哪些，本地跑一次：

```bash
python3 scripts/emoji_assets.py sync
```

## 权利与署名

站点可见的署名与说明在 `content/licenses.md`（页面 `/licenses/`）。修改图形或源时请同步更新该页。
