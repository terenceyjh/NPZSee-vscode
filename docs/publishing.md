# 发布到 Visual Studio Marketplace

本指南替代桌面 roadmap 中的 PyPI 步骤。插件以 **VSIX** 分发；六个平台是同一扩展的
六个目标包。无需为插件准备 wheel 或让用户安装 Python。

当前状态：显示名 **NPZSee**；仓库 **terenceyjh/NPZSee-vscode**；扩展 name 为
`npzsee`；版本 `0.2.1`；publisher 为 `TerenceYang`，完整扩展 ID 为 `TerenceYang.npzsee`。
发布者已创建，依据用户提供的 Marketplace 管理页截图完成配置。尚未向商店上传。

## 1. 发布者已创建

管理页中已显示 **Jinghao Yang (TerenceYang)**，账号角色为 Owner。括号中的
`TerenceYang` 是发布者 ID，无需再次点击 Create publisher。可在 **Details** 中核对 ID。
**ID 创建后不能修改**；它与显示名称、GitHub 仓库名是不同概念。

本项目已执行以下配置，之后生成的 0.2.1 包均使用该发布者：

```sh
npm run configure:publisher -- TerenceYang
```

该命令修改 `package.json`。提交并推送后，六平台 CI 会重建匹配该 ID 的安装包。
正式扩展 ID 是 `TerenceYang.npzsee`，与本地测试版 `npzsee-local.npzsee` 和旧
`npzview-local.npzview` 不同；迁移后卸载旧版本，避免两个查看器同时竞争文件关联。

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

具体下一步：

1. 在截图的当前页面点击 **New extension** 右侧下拉箭头，选择 **Visual Studio Code**。
2. 上传 `NPZSee-vscode-0.2.1-win32-x64.vsix`。不要上传旧的 0.2.0 包或源码压缩包。
3. 核对发布者 `TerenceYang`、名称 `NPZSee`、版本 `0.2.1`，完成页面的上传/发布操作。
4. 等验证结束后，在同一扩展中添加其余五个同版本的目标包，勿新建五个不同扩展。
5. 状态成功后，用干净配置安装 `TerenceYang.npzsee` 验证商店安装。

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
