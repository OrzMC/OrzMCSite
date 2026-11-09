# 搜索引擎 / AI 搜索提交与观察

> 状态：生效中 · 最后更新：2026-11-09

## 已自动化（无需账号）

- **sitemap.xml**：`/sitemap.xml` 由 Hugo 生成，含全部页面与 `lastmod`。
- **robots.txt**：显式放行主流 AI 爬虫（GPTBot / OAI-SearchBot / ClaudeBot / PerplexityBot / Google-Extended 等）。
- **llms.txt**：`/llms.txt` 由 `layouts/index.llms.txt` 自动生成，列出站点摘要、主要页面、文章与项目入口。
- **IndexNow**：`main` 每次发布后，`site_deploy.yml` 会把 sitemap 里的全部 URL 提交到
  `https://api.indexnow.org/indexnow`（Bing / Yandex / Seznam / Naver 共享），失败不影响发布。
  验证文件是 `static/<key>.txt`（文件名即 key），不要删除或改名。
- **结构化数据**：WebSite / Organization / WebPage / SoftwareApplication / Article / BreadcrumbList。
- **站长验证 meta**：`params.toml` 预留 `google_site_verification` / `bing_site_verification`，
  填入后自动输出 `google-site-verification` / `msvalidate.01`。

## 需要维护者账号（一次性）

### Google Search Console

1. 打开 <https://search.google.com/search-console>，添加资源（推荐「网域」，需 DNS 权限；或「网址前缀」）。
2. 验证：DNS TXT（推荐）或 HTML 标记——把 HTML 标记里的 `content` 值填入
   `config/_default/params.toml` 的 `google_site_verification`，push `main` 发布后再点验证。
3. 提交 Sitemap：`https://orzmc.jokerhub.cn/sitemap.xml`。
4. 对 `/client/`、`/plugin/`、`/user/` 等关键页用「网址检查 → 请求编入索引」。

### Bing Webmaster Tools

1. 打开 <https://www.bing.com/webmasters>，添加站点（支持从 GSC 导入）。
2. 验证：DNS 或 HTML meta——把值填入 `bing_site_verification`，发布后验证。
3. 提交 Sitemap；「IndexNow」页可查看自动提交记录。
4. 可在「URL 提交」里补交重点页面（IndexNow 已覆盖全量 sitemap）。

## 观察 AI 引用

- **Bing Webmaster**：查看「AI Performance」报告（Copilot / Bing AI 的引用与展示）。
- **GSC**：看品牌词（OrzMC、OrzMC 启动器、OrzMC 插件）的展示/点击与落地页；
  AI Overviews 的引用不单独区分，只能从查询与页面趋势间接观察。
- **手工抽查（建议每月）**：在 ChatGPT / Perplexity / Copilot 提问
  「OrzMC 启动器怎么用」「OrzMC 插件是什么」，记录是否引用官网、引用了哪个页面。
- 本站无服务端访问日志，统计只有不蒜子的聚合 PV/UV，**无法按 referrer 归因 AI 流量**。
  若需要精确归因，需引入隐私友好的分析服务并同步更新隐私政策。

## 注意

- `llms.txt` 只是给 AI 爬虫的摘要声明，是否收录/引用由各家决定，不保证生效。
- 更新验证码或 SEO 参数后必须重新发布（push `main`）。

## 日常更新护栏（减少遗忘）

- **CI 阻断**（`scripts/check_content.py`）：标题/描述/图片资源/重复标题；独立页描述必须 20–160 字。
- **自动生成**：sitemap、llms.txt（主要页面按 `menu.main` 自动收录）、robots、JSON-LD、IndexNow。
- **新增独立页**：写 `description` + 加进 `menu.main`；产品页还要在 `schema.html` 登记 `SoftwareApplication`。
- **改 URL**：用 `aliases`，避免旧链接 404。
- **第三方脚本/分析**：先改 `docs/compliance/privacy.md` 再跑同步器。
- **定期审计**：`python3 scripts/seo_audit.py`（线上全量）；GitHub Actions `SEO / GEO Audit` 每周一自动跑。
