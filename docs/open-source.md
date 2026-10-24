# 来源与本地开发状态

本项目是从 Rust/egui 桌面版 npzsee 复制出的独立 VS Code 项目，桌面版继续独立存在。
npzsee 源自 LiukDiihMieu/npyquick；原始版权、GPL-3.0-or-later 及修改说明保留在
`LICENSE`、`NOTICE` 和 `CHANGELOG.md`。插件名称和 publisher 暂定，尚未公开发布。

本地 VSIX 包含无界面 Rust 后端、界面与许可证文本。私有实验记录、prompt、构建缓存、
测试用户配置和工具链不进入包中。开发用的 TypeScript/打包/测试依赖不作为运行时 npm
依赖分发；Rust 的锁定依赖许可证由 `scripts/collect-licenses.py` 收集。

未来公开发布前确定实际名称、仓库、维护者和联系方式，验证目标平台，并提供与二进制
版本匹配的源码及构建说明。桌面版的 PyPI/wheel 流程与本插件的 VSIX 流程分别维护。
目前没有向原始 Git origin 推送，也没有向 PyPI 或 Marketplace 上传。
