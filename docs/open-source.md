# 来源与公开发布状态

NPZSee-vscode 是从 npzview 的 Rust 重写版及 VS Code 原型发展出的独立项目，桌面版
单独维护。公开仓库为 https://github.com/terenceyjh/NPZSee-vscode。
上游为 LiukDiihMieu/npyquick；原始版权、GPL-3.0-or-later 及修改说明保留在
`LICENSE`、`NOTICE` 和 `CHANGELOG.md`。产品名确定为 NPZSee，Marketplace publisher
仍待用户注册；GitHub 预览包使用 `npzsee-local`，尚未上传插件商店。

本地 VSIX 包含无界面 Rust 后端、界面与许可证文本。私有实验记录、prompt、构建缓存、
测试用户配置和工具链不进入包中。开发用的 TypeScript/打包/测试依赖不作为运行时 npm
依赖分发；Rust 的锁定依赖许可证由 `scripts/collect-licenses.py` 收集。

GitHub Release 提供六平台 VSIX、SHA256 校验和，以及包含锁定 Rust 依赖的对应源码归档。
源码可离线解析 Rust 依赖；重新构建仍需安装 Rust、平台链接器，以及构建界面所需的
Node/npm 开发工具。构建说明见 README 和 docs/testing.md。
本插件通过 Marketplace 分发；docs/publishing.md 替代桌面 roadmap 中的 PyPI 步骤。
本项目只推送至独立仓库，不向上游或桌面仓库推送。
