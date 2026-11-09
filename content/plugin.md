---
menu: 
  main:
    weight: 4
title: 自研插件
featured_image: "/images/minecraft_plugin.png"
toc: true
---

---

服务器由自研插件 **OrzMC** 辅助运营管理：面向 Paper / Folia 服务端，把白名单、权限、群机器人、安全防护和日常维护收拢到一套插件里，开箱即用，内置中英文界面。

## 下载与安装

- [Hangar（Paper 官方生态）](https://hangar.papermc.io/OrzMC/OrzMC)
- [Modrinth](https://modrinth.com/plugin/orzmc)
- [GitHub Releases](https://github.com/OrzMC/OrzMCPlugin/releases)

**安装步骤**

1. 从上面任一渠道下载插件；
2. 放进服务端的 `plugins/` 目录；
3. 重启服务器，插件会自动生成配置并开始工作。

运行需要 **Paper 26.2+** 或 **Folia** 服务端、**Java 25**。想启用玩家权限组时再装一个 [LuckPerms](https://luckperms.net/)（可选，不装不影响其它功能）。

## 功能一览

| 模块 | 能做什么 |
|:--|:--|
| **白名单管理** | 强制白名单；在群里增删查；长期不上线的玩家自动清理；被拒玩家会收到友好提示 |
| **权限系统** | 访客 → 成员 → 建造者 → 管理员四级权限：成员按在线时长自动晋升，更高等级可申请、由管理员审核，也可手动升降级 |
| **群机器人** | QQ / 飞书 / Telegram / Discord（EasyBot 网关另支持微信）；群内即可完成白名单、备份、优化、审核、控台等操作，服务器事件实时推送到群 |
| **玩家通知** | 进出服、被踢时推送玩家、世界、坐标、在线人数和权限组 |
| **安全防护** | 按国家/地区限制进服；IP 与玩家名黑名单；危险命令拦截与审计；聊天反垃圾；进服限流；常见漏洞加固 |
| **TNT 保护** | 限制 TNT 可放置区域（可设豁免区）；爆炸告警合并推送；可控制重生锚爆炸 |
| **世界维护** | 一键备份或优化地图，进度实时可查；结果只回到发起的群；维护期间服务器列表自动显示维护提示 |
| **跨服传送门** | 管理员创建传送门，玩家踩上即跨服传送，可要求先登录再传送 |
| **传送弓** | 射箭传送到落点，自动选择安全落点，远距离也能稳定落地 |
| **新手指南书** | 新玩家首次进服自动获得；内容可自定义，丢弃后可 `/guide` 重新获取 |
| **游戏内配置** | 常用设置可在游戏内 `/config` 查看和修改，改完即生效，无需重启 |
| **自动更新** | 定时检查新版本（正式版 / 开发版），可提示或自动下载，重启后完成升级 |

## 群机器人

支持两种接入方式，任选其一：

- **EasyBot 网关**：已有 EasyBot 服务时直接接入，一个网关统一管理 QQ / 微信 / 飞书 / Telegram / Discord；
- **内置直连**：插件自己连接平台，无需额外进程，支持 QQ / 飞书 / Telegram / Discord。

在群里发送 `$h` 可查看全部群命令，命令后加 `?` 查看详细用法。配置步骤见[机器人接入手册](https://github.com/OrzMC/OrzMCPlugin/tree/main/docs/manuals)。

## 文档与反馈

- [完整功能清单](https://github.com/OrzMC/OrzMCPlugin/blob/main/docs/features.md)
- [机器人接入手册](https://github.com/OrzMC/OrzMCPlugin/tree/main/docs/manuals)
- [更新日志](https://github.com/OrzMC/OrzMCPlugin/blob/main/CHANGELOG.md)
- 问题反馈：[GitHub Issues](https://github.com/OrzMC/OrzMCPlugin/issues)

玩家常用入口（新手书 `/guide`、权限申请 `/apply`、服务器菜单 `/menu`）见[玩家手册](/user/)。
