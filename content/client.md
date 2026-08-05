---
menu: 
  main:
    name: "客户端"
    weight: 2
title: 客户端启动器
toc: true
---
---
## 各版本游戏需要的 Java 版本

具体版本要求以官方发布为准。

|游戏版本|Java 版本|
|:-------:|:----:|
|≥26.1| ≥25 |
|≥1.20.5| ≥21 |
|≥1.18| ≥17 |
|1.17| ≥16 |
|<1.17| ≥8 |

## 自研 macOS 启动器

使用 Swift & SwiftUI 编写的 macOS 平台启动器:
[代码仓库](https://github.com/OrzMC/OrzMCApp) -
[版本下载列表](https://github.com/OrzMC/OrzMCApp/releases)

![OrzMC_MacOS](/images/client/orzmc_macOS.png)

视频介绍👇

|下载安装|操作指南|
|------|-------|
|[![安装](/images/video_cover/orzmc_install.png)](https://www.bilibili.com/video/BV1b4HAeBERS)|[![使用](/images/video_cover/orzmc_usage.png)](https://www.bilibili.com/video/BV1hBtUeJE8y)|

## Python 命令行启动器

Mac/Linux系统可以使用：[代码仓库](https://github.com/OrzMC/OrzPythonMC) - [PyPI发布](https://pypi.org/project/OrzMC/)

![OrzMC_CLI_PY](/images/client/orzmc_cli_py.png)

安装方法:

```bash
# 安装应用到用户目录下
python3 -m pip install --user orzmc
# 添加用户二进制目录到环境变量
echo 'PATH=$PATH:'$(python3 -m site --user-base)/bin >> ~/.bashrc
# 使用添加的环境变量立即生效
source ~/.bashrc 
# 运行 orzmc 命令
orzmc
```

## 跨平台 Java 启动器 - HMCL

HMCL 是一个跨平台的 Java 启动器，支持 Windows、Unix/Linux、macOS。

 [HMCL主页](https://hmcl.huangyuhui.net/) -
 [代码仓库](https://github.com/huanghongxun/HMCL) -
 [下载地址](https://ci.huangyuhui.net/job/HMCL/)

![HMCL_JAVA](/images/client/hmcl_java.png)

Windows 安装运行：

```
下载 `*.exe` 文件，并鼠标双击运行
```

Unix/Linux/macOS 命令行运行：

```bash
# 下载 `*.jar`文件，并在命令行中使用`java -jar `命令运行
java -jar HMCL.jar 
```

HMCL 可以安装 Fabric 装载器，常用的 MOD 列表：

|名称|功能|
|:---|:---|
|[Reply MOD](https://www.replaymod.com/)|客户端视频录制|

## 客户端开光影

OptiFine 的 jar 包路径要包含在最前面，否则会有问题，解决方案参考：<https://www.bountysource.com/issues/74856476-lwjgl-crash-with-optifine>

- [OptiFine](https://www.optifine.net/home): 客户端开光影扩展

ShaderPack
  
- [BSL Shader on Curse Forge](https://www.curseforge.com/minecraft/customization/bsl-shaders)
- [BSL Shader](https://bitslablab.com): 客户端光影渲染器


Resource packs

- [BSL MiniPack](https://bitslablab.com/bslminipacks/#download)
- [Chromahills](http://chromahills.com): 客户端光影材质包

## 客户端使用模组

下载Forge - [官网](https://files.minecraftforge.net/)

Forge 所需 Java 版本与 Minecraft 版本一致，1.12 及以前通常使用 JDK8，请确认版本要求。

运行命令: `java -jar forge-*.jar --installServer`

把 mod 加入到 `mods` 文件夹下，包括 `SpongeForge.jar`

- [暮色森林](https://github.com/TeamTwilight/twilightforest)

启动服务器
```
java -jar forge-*universal.jar
```
