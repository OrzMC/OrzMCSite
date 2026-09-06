---
menu: 
  main:
    name: "客户端"
    weight: 2
title: 客户端启动器
toc: true
---
---

Minecraft Java 版需要启动器才能运行。本页从玩家视角介绍三种选择：自研的 **OrzMC 命令行启动器**（跨平台，首选）、自研的 **OrzMC macOS 启动器**，以及第三方备选 **HMCL**。

不知道怎么选，先看下表；想直接进服（白名单申请、服务器地址），见[玩家手册](/user/)。

## 快速选择

| 使用场景 | 推荐启动器 | 特点 |
|:--|:--|:--|
| Windows / macOS / Linux 通用，想省事 | **OrzMC 命令行启动器** | 一条命令装好；版本任选、多模式切换；Java 自动托管 |
| 只用 macOS，习惯图形界面 | **OrzMC macOS 启动器** | 原生应用，界面直观 |
| 想要图形界面和更丰富的管理功能 | **HMCL**（第三方） | 中文友好、功能全面 |

## OrzMC 命令行启动器（跨平台 · 首选）

**OrzMC** 是自研的跨平台 Minecraft 启动工具，一条命令安装、即装即用，是 Windows / macOS / Linux 玩家最省心的选择：

- **全平台覆盖**：macOS / Linux / Windows × x86_64 / arm64；
- **Java 免安装**：按游戏版本自动下载匹配的 Java 运行时并托管，不依赖系统 Java；
- **版本任选**：正式版、测试版、老版本都能装，内置交互式版本选择器，输入即过滤；
- **多模式运行**：客户端支持原版（`vanilla`）/ `fabric` / `forge` 一键切换，装模组、开光影不再手工折腾；
- **多版本并存**：一个版本一个目录互不干扰，文件缺失启动时自动补齐。

[项目主页](https://orzmc.github.io/OrzPythonMC/) · [代码仓库](https://github.com/OrzMC/OrzPythonMC) · [Releases 下载](https://github.com/OrzMC/OrzPythonMC/releases)

### 安装

**macOS / Linux**：在终端粘贴下面一行并回车（macOS 自带 curl）：

```bash
curl -fsSL https://orzmc.github.io/OrzPythonMC/install.sh | sh
```

**Windows**：在 PowerShell 5.1+ 中执行：

```powershell
irm https://orzmc.github.io/OrzPythonMC/install.ps1 | iex
```

安装器自动识别平台，并把 `orzmc` 命令登记到 PATH；**重复执行即升级**，全程无需先装 Python 或 Java。想固定版本、自定义安装目录，可先查看 `install.sh --help`。

备选安装方式：

- 从 [Releases](https://github.com/OrzMC/OrzPythonMC/releases) 下载对应平台二进制（`orzmc-macos-*` / `orzmc-linux-*` / `orzmc-windows-*`）；
- 已有 Python 3.10+：`python3 -m pip install --user orzmc-app`（或 `uv tool install orzmc-app`）。

### 启动与常用参数

```bash
orzmc client                  # 弹出版本选择器：选好回车启动，直接回车用最新正式版
orzmc client -v 26.2 -u Steve # 指定版本与玩家名（版本号换成你要玩的即可）
```

第一次启动会自动下载该版本的全部文件（几百 MB，耐心等待），之后秒开。

| 参数 | 说明 |
|:--|:--|
| `-v <版本>` | 版本号；不填时弹出交互选择器（`↑↓` 选择、输入即时过滤、`t` 切换正式/测试版），非交互环境自动用最新正式版 |
| `-u <玩家名>` | 游戏内玩家名，默认 `guest` |
| `-t <模式>` | `vanilla` 原版（默认）/ `fabric` / `forge` |
| `-m / -x <内存>` | 最小 / 最大内存，默认 `512M` / `2G`，如 `-x 4G` |
| `--root-dir <目录>` | 游戏数据根目录（默认 `~/minecraft`） |
| `--help` | 查看完整参数，如 `orzmc client --help` |

### 版本与数据管理

```bash
orzmc list                 # 列出已安装版本
orzmc remove -v 26.2 --yes # 删除指定版本
orzmc self-uninstall --yes # 卸载工具本身（游戏数据默认保留）
```

游戏数据默认存放在 `~/minecraft`（Windows 为 `C:\Users\你的用户名\minecraft`），一个版本一个目录；其中 `versions/<版本>/client` 是该版本的游戏目录——**存档、模组、光影都放在这里**。

## OrzMC macOS 启动器

使用 Swift & SwiftUI 编写的 macOS 原生启动器，图形界面操作、无需命令行，适合只用 macOS 的玩家：

[代码仓库](https://github.com/OrzMC/OrzMCApp) · [版本下载列表](https://github.com/OrzMC/OrzMCApp/releases)

![OrzMC macOS 启动器](/images/client/orzmc_macOS.png)

配套视频：

|下载安装|操作指南|
|------|-------|
|[![安装](/images/video_cover/orzmc_install.png)](https://www.bilibili.com/video/BV1b4HAeBERS)|[![使用](/images/video_cover/orzmc_usage.png)](https://www.bilibili.com/video/BV1hBtUeJE8y)|

## HMCL（第三方备选）

[HMCL](https://hmcl.huangyuhui.net/) 是老牌的跨平台第三方 Java 启动器（Windows / Linux / macOS），图形界面、中文友好、功能全面，支持版本管理、加载器安装、模组管理与多实例。想用图形界面、或需要更丰富管理功能时，可作为备选。

- 下载地址：[HMCL 官网](https://hmcl.huangyuhui.net/) · [HMCL CI 构建](https://ci.huangyuhui.net/job/HMCL/) · [GitHub](https://github.com/huanghongxun/HMCL)
- Windows：下载 `*.exe`，双击运行；
- macOS / Linux：下载 `*.jar`，用 Java 运行（需自备 Java，版本要求见文末附录）：

```bash
java -jar HMCL.jar
```

![HMCL](/images/client/hmcl_java.png)

## 开光影与装模组

装模组、开光影的本质是同一件事：**用带模组加载器的模式启动游戏，再往游戏目录里放文件**。下面以 OrzMC 命令行启动器为例说明，HMCL 中操作思路相同。

### 第一步：选加载器模式

| 模式 | 适用场景 |
|:--|:--|
| **fabric** | 现代模组主流，加载快、光影方案成熟，**推荐默认** |
| **forge** | 部分只支持 Forge 的老牌大型模组 |

> 旧版单 jar 的 OptiFine 也能开光影，但它与现代 Fabric / Forge 模组不兼容，除非某个模组明确要求，否则不推荐。

### 第二步：启动一次并放置文件

1. 用加载器模式启动一次，完成初始化：`orzmc client -t fabric -u Steve`（HMCL：先在界面给对应版本装上 Fabric / Forge 再启动）
2. 关闭游戏，把下载好的模组 `.jar` 放进 **`mods`** 目录；把光影包（`.zip`）放进 **`shaderpacks`** 目录
3. 再次启动，模组 / 光影即生效

游戏目录在哪：

| 启动器 | 游戏目录 |
|:--|:--|
| OrzMC 命令行启动器 | `~/minecraft/versions/<版本>/client`（Windows 为 `%USERPROFILE%\minecraft\versions\<版本>\client`） |
| HMCL | 对应版本的 `.minecraft` 目录（主界面有「打开游戏目录」入口） |

### 第三步：下载所需组件

- **前置模组**：多数 Fabric 模组要求先装 **Fabric API**（它本身也是一个模组）；加载器与模组都必须匹配你的 MC 版本。模组在 [Modrinth](https://modrinth.com/mods) 或 [CurseForge](https://www.curseforge.com/minecraft/mc-mods) 下载。
- **光影组合**：装好下面一组后，即可在「视频设置 → 光影」中选择光影包。

| 模式 | 推荐组合 | 说明 |
|:--|:--|:--|
| Fabric（推荐） | **Iris** + **Sodium** | Iris 负责加载光影，Sodium 大幅优化性能 |
| Forge | **Oculus** + **Embeddium** | 与上一组功能对等 |

- **光影包**：如 BSL、Complementary、SEUS、Sildur's Vibrant，在 [Modrinth](https://modrinth.com/shaders) 或 CurseForge 搜索下载（游戏本身支持的那类 `.zip`）。

## 附录：Java 版本要求

仅在使用 **HMCL** 或自行管理 Java 时需要对照；OrzMC 命令行启动器会自动下载匹配的 Java 运行时，无需关心。具体要求以官方发布为准。

|游戏版本|Java 版本|
|:-------:|:----:|
|≥26.1| ≥25 |
|≥1.20.5| ≥21 |
|≥1.18| ≥17 |
|1.17| ≥16 |
|<1.17| ≥8 |
