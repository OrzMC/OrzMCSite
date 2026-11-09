# OrzMCSite

[![Publish Web Page](https://github.com/OrzMC/OrzMCSite/actions/workflows/site_deploy.yml/badge.svg)](https://github.com/OrzMC/OrzMCSite/actions/workflows/site_deploy.yml)
[![pages-build-deployment](https://github.com/OrzMC/OrzMCSite/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/OrzMC/OrzMCSite/actions/workflows/pages/pages-build-deployment)

OrzMC私服官方网站

## 使用方式

```bash
# 安装最新版Hugo
brew install hugo
# 拉取仓库代码到本地
git clone https://github.com/OrzMC/OrzMCSite.git
# 切换到仓库目录下
cd OrzMCSite
# 同步网站主题子仓库模块
git submodule sync
# 本地预览网站
./preview
```

## SEO / 搜索引擎提交

sitemap、robots、llms.txt 与 IndexNow 已自动化；Google Search Console / Bing Webmaster 的
验证与提交步骤见 [`docs/seo-search-engines.md`](docs/seo-search-engines.md)。

发布后/定期审计线上 SEO：`python3 scripts/seo_audit.py`（每周一由 Actions 自动跑）。
