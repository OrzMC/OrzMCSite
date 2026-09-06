---
menu: 
  main:
    weight: 4
title: 自研插件
---

---

服务器由自研插件 **[OrzMC](https://hangar.papermc.io/OrzMC/OrzMC)** 辅助运营管理。它是一个面向 Paper / Folia 的服务端管理插件，把准入、权限、通知、群机器人等日常运维工作收拢到一套系统里。

发布与源码：

- [Hangar](https://hangar.papermc.io/OrzMC/OrzMC)（Paper 生态发布平台）
- [Modrinth](https://modrinth.com/plugin/orzmc)
- [GitHub 源码](https://github.com/OrzMC/OrzMCPlugin) · [更新日志](https://github.com/OrzMC/OrzMCPlugin/blob/main/CHANGELOG.md) · [功能文档](https://github.com/OrzMC/OrzMCPlugin/blob/main/docs/features.md)

## 功能总览

| 功能模块 | 说明 |
|:--|:--|
| **权限系统（Rank & Review）** | 四级玩家权限链（访客 → 成员 → 建造者 → 管理员），基于 LuckPerms：自动晋升、申请/审核（`/apply`、`/review`）、手动升降级；启动时自动创建权限组，无需手工配置 |
| **白名单管理** | 管理员可通过机器人命令添加 / 移除白名单，自动清理不活跃玩家；未在白名单内被踢出的玩家会收到友好提示 |
| **多平台机器人（双通道）** | `im.yml` 的 `backend` 在 **EasyBot 网关**（默认：经外部网关统一接入 QQ / Telegram / Discord / 飞书 / 微信）与 **内置直连 builtin**（插件直连官方 API，已落地 QQ / 飞书 / Telegram / Discord，无需外部网关进程）之间**二选一**；两通道的业务命令与通知语义一致，11 个机器人命令 + 50+ 可定制消息模板 |
| **跨服传送门** | 管理员创建传送门，玩家踩上即跨服传送，可选先验证登录再传送 |
| **TNT 保护** | 限制 TNT 可放置区域（可设区域白名单豁免）；爆炸告警在群聊聚合提示（`×N` + 首个坐标），并控制重生锚爆炸行为 |
| **安全控制** | GeoIP 国家限制进服、IP 黑名单（精确 IP / CIDR / 通配符）、玩家名拒入规则（精确 / 前缀 / 后缀 / 关键词 / glob / 正则）、可选二次登录校验；另有危险命令拦截与审计、聊天反垃圾、进服限流与漏洞加固 |
| **传送弓** | 射箭传送到落点，自动寻找安全落点、加载飞行路径区块，远距离射击稳定落地 |
| **世界维护** | 一键备份或优化地图，实时进度提示，维护期间服务器 MOTD 自动切换 |
| **插件自更新** | 定时查询 Hangar 新版本（正式版 / 开发版通道），sha256 校验后下载到 `plugins/update/`，重启即完成升级 |
| **玩家通知** | 进出服 / 被踢出时推送详情（世界、坐标、在线人数、权限组）到群聊 |
| **新手指南书** | 新玩家首次进服自动获得指南书，内容可通过 YAML 自定义引导文案 |
| **运行时配置** | 游戏内 `/config` 管理 29 项运行时配置，支持 `list / get / set / reset / dump / reload`，修改后热重载生效 |

玩家常用入口（`/guide` 新手书、`/menu` 菜单、`/apply` 晋升申请等）详见[玩家手册](/user/)。

## 部署与兼容

- 面向 **Paper** 服务端开发，同一 JAR 同时兼容 **Folia**（`folia-supported: true`）；因兼容 Bukkit / Spigot API，对相关插件开发者同样友好。
- 可选依赖 [LuckPerms](https://luckperms.net/)（v5.5+）启用权限系统；未安装时其余功能照常运行。
- **机器人双通道二选一**：
  - `im.yml` 的 `backend` 切换 `easybot`（默认）或 `builtin`；`easybot` 需先部署 EasyBot 网关服务，`builtin` 则由插件直连各平台官方接口，无需外部进程；
  - 改动 `im.yml`（backend / 凭据 / 代理）需重启生效；两通道的**会话标识体系不同**——EasyBot 用后台分配的会话 key（如 `qq:conv_xxx`），builtin 用平台原生会话标识，切换后需通过 `/config im bind` 重新绑定；
  - 通道健康状态：`easybot` 用游戏内 `/bot` 查看，`builtin` 用 `/config im status`（含平台连接 / 绑定 / 未绑定候选）。
  - 各平台分步接入手册见源码仓库 [`docs/manuals/`](https://github.com/OrzMC/OrzMCPlugin/tree/main/docs/manuals)。
- 使用中发现问题可直接到 [GitHub Issues](https://github.com/OrzMC/OrzMCPlugin/issues) 反馈。
