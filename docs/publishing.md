# 发布到 Visual Studio Marketplace

本指南替代桌面 roadmap 中的 PyPI 步骤。插件以 **VSIX** 分发；六个平台是同一扩展的
六个目标包。无需为插件准备 wheel 或让用户安装 Python。

当前状态：显示名 **NPZSee**；仓库 **terenceyjh/NPZSee-vscode**；扩展 name 为
`npzsee`；版本 `0.2.0`；publisher 暂为 `npzsee-local`。该 publisher 只用于本地测试，
不代表 Marketplace 账号，也不能用于正式发布。用户尚未注册发布者，当前工作先准备资料。

## 1. 注册发布者：需要你操作

打开 [Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)，使用你希望
长期管理插件的 Microsoft 账号登录，选择 **Create publisher**。填写显示名称和唯一
publisher ID。**ID 创建后不能修改**；它与显示名称、GitHub 仓库名是不同概念。

创建后把 publisher ID 告诉维护者，或在本地执行：

```sh
npm run configure:publisher -- your-publisher-id
```

该命令修改 `package.json`。提交并推送后，六平台 CI 会重建匹配该 ID 的安装包。
正式扩展 ID 将是 `your-publisher-id.npzsee`。本地测试版与旧 `npzview-local.npzview`
使用不同 ID；迁移后卸载旧版本，避免两个查看器同时竞争文件关联。

## 2. 核对发布材料

- 公开仓库中有 GPL 正文、来源 credit、NOTICE、README、截图、PNG 图标和构建说明。
- 六平台 CI 完成构建、Rust/协议/翻译检查，并生成对应 VSIX。
- Windows 的实际 VS Code 交互检查覆盖详情栏、多维导航和六种语言；其他系统的
  原生二进制测试与 GUI 验证边界分别说明，不把交叉编译称为真机实测。
- 在最终 publisher 下重新打包；运行 `npm run marketplace:check`，排除临时 publisher。
- `npm run check:release` 校验 VSIX 中的平台、CPU、必需文件和私有文件排除情况。
- GitHub Release 提供相同版本的完整源码、锁定 Rust 依赖源码和校验和。

公开发布前可以先生成预览版 VSIX 供自己试用。源数据和测试截图的私有内容不应上传；
仓库中的展示截图均来自合成数据。

## 3. 首次上传：推荐直接使用网页

在发布者管理页中新建 **Visual Studio Code** 扩展并上传对应 VSIX，完成平台检查后发布。
将其余目标平台的同名同版本 VSIX 添加到同一扩展。Marketplace 按用户实际平台选择
相应包。页面会显示校验、扫描或审核状态；只有成功发布后才能在商店中搜索安装。

首次网页上传无需把发布 token 交给本项目，也无需设置自动发布。发布后在一个干净
配置中安装 `publisher.npzsee`，检查文件关联、更新路径和卸载行为。

## 4. 以后更新

更新版本号 → 验证 → 六平台构建 → 对应源码归档 → 上传新版包。保持 publisher 和 name
不变才能延续 Marketplace 中的安装和更新关系。显示名称可按后续产品需要调整。

如以后需要命令行发布，可使用 `@vscode/vsce` 的 `publish --packagePath`，或按官方
文档配置 Microsoft Entra ID 自动发布。本仓库不会把账户凭据写进代码或默认自动上传。
当前官方文档已提示 2026-12-01 后停用 Azure DevOps 全局 PAT，长期自动化应采用官方
推荐的身份方案；网页首次发布流程不依赖项目保存 PAT。

## 官方资料

- [发布、publisher、网页管理和认证](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [按平台发布 VSIX](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#platform-specific-extensions)
- [扩展清单、名称和图标](https://code.visualstudio.com/api/references/extension-manifest)
