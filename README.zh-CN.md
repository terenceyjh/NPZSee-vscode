# NPZSee for VS Code

**直接打开 NumPy 文件，逐层浏览多维数组。**

NPZSee 是通用的 `.npy` / `.npz` 只读查看器。无需另写脚本，即可查看多维数组、
精确数值、字符串、JSON、波形与直方图。Rust 负责解析、解压、映射、切片、缓存、
抽稀与统计，TypeScript / JavaScript 负责 VS Code 集成和界面。

[English](README.md) · [独立桌面版](https://github.com/terenceyjh/npzsee) · [发布指南](docs/publishing.md) · [适用于插件的 roadmap](docs/roadmap.md)

本仓库提供 **VS Code 插件版**。如果你希望无需 VS Code、直接运行独立程序，可以使用
配套的 **[NPZSee 桌面版](https://github.com/terenceyjh/npzsee)**，支持 Windows、macOS 和 Linux。

## 主要功能

- 左侧列出全部数组，支持名称筛选；仅在选中后加载数据。
- 多维数组逐层进入，二维矩阵和一维向量可直接查看，通过路径返回上层。
- 表格覆盖全部行列；点击单元格后，在 **Table 内部固定详情栏** 查看、选择和复制
  完整内容，再点击其他单元格即可更新，无需弹窗。窄窗口中详情栏自动移到表格上方。
- 大整数保留完整位数；Unicode、长字符串、JSON 树与原始 JSON 数字文本均可查看。
- 波形支持按行、X/Y、复数分量、对数坐标、缩放和平移、原始点读数和 SVG 导出。
- 直方图支持带抽样标记的快速预览，以及 Rust 全量扫描的精确统计。
- 界面内可切换简体中文、英语、法语、西班牙语、俄语和阿拉伯语；支持阿拉伯语 RTL。

## 性能方式

原始大数组保留在 Rust 端，NPY 直接映射，NPZ 选中条目按需解压并映射。
界面只接收当前表格页、统计结果和按显示宽度生成的曲线点。峰谷抽稀保留窄脉冲，
放大索引波形后重新读取可见区间的原始数据。

使用插件无需安装 Python、NumPy、Qt 或 Matplotlib。插件不改写原文件，也不启动
本地 HTTP 服务；关闭文件后释放后端进程、映射和临时文件。

## 安装

在 [GitHub Releases](https://github.com/terenceyjh/NPZSee-vscode/releases/latest) 下载对应平台的
VSIX，在 VS Code 扩展面板选择 **⋯ → 从 VSIX 安装…**。打开 NumPy 文件即可；
若被其他编辑器接管，可选择 **重新打开编辑器的方式… → NPZSee**。

普通 Intel/AMD Windows 电脑可[直接下载 Windows x64 安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-win32-x64.vsix)。
下载 `.vsix` 后直接安装，无需解压；GitHub 的 `Source code` 下载项是源码，不是插件安装包。

| 系统 | x64 | ARM64 |
| --- | --- | --- |
| Windows | [安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-win32-x64.vsix) | [安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-win32-arm64.vsix) |
| Linux | [安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-linux-x64.vsix) | [安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-linux-arm64.vsix) |
| macOS | [安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-darwin-x64.vsix) | [安装包](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-darwin-arm64.vsix) |

目标平台为 Windows / Linux / macOS × x86_64 / ARM64，共六种 64 位组合。
WSL、SSH 和容器中的扩展要匹配远程主机的平台。平台要求和实际验证边界见
[跨平台说明](docs/cross-platform.md)。

从 0.2.1 起，安装包使用正式 publisher `TerenceYang`，完整扩展 ID 为 `TerenceYang.npzsee`。
迁移时卸载旧的 `npzsee-local.npzsee` 或 `npzview-local.npzview`，避免出现两个查看器。
发布者已注册；插件市场上传步骤见[发布指南](docs/publishing.md)。
`NPZSee` 是显示名称，`NPZSee-vscode` 是仓库名称，Marketplace 发布者 ID 是独立字段。

## 开发与验证

```sh
npm ci
npm run build:backend
npm run check
npm run build
npm test
npm run test:i18n
npm run package:local
```

Rust 1.96+、Node.js 22+ 和对应平台链接器用于构建；Python/NumPy 仅用于测试。
[完整测试说明](docs/testing.md)包含实际 VS Code 窗口中的交互检查。
[桌面版项目](https://github.com/terenceyjh/npzsee)提供独立程序和 Python wheel 安装包；
本仓库的分发流程为 VSIX 和插件市场。

## 来源与许可证

采用 **GPL-3.0-or-later**。本项目由 npzview 的 Rust 重写版及 VS Code 原型发展而来，
源自 [LiukDiihMieu/npyquick](https://github.com/LiukDiihMieu/npyquick)，保留上游版权与
修改说明，详见 `LICENSE`、`NOTICE`。发布包配套提供源码、Rust 依赖源码和构建说明。
私有数据、凭据、工具链和缓存不进入公开仓库或安装包。
