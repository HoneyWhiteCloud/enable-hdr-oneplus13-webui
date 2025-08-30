**Read this in other languages: [English](README.md)**


# 在 OnePlus 13 上启用 HDR (支持 WebUI)

这是什么?

默认情况下,OnePlus 13 上只有少数应用可以开启 HDR。
本模块扩展了白名单,使更多应用能够启用 HDR 和 Dolby Vision
。
现在还新增了一个 WebUI, 你可以直接在浏览器里勾选或取消应用, 无需手动修改 XML。

应用列表

- 内置了常见应用的预设(Netflix, YouTube, Prime Video, Disney+ 等)

- 同时支持通过 WebUI 自行添加/删除应用。

WebUI

- 安装模块后, 安装以下APK然后授予其ROOT权限:

 >https://github.com/MMRLApp/WebUI-X-Portable/releases


- **全新增强功能:**
 - **智能搜索**: 支持实时按应用名或包名搜索，瞬时过滤结果
 - **智能应用管理**: 自动检测并显示所有已安装的应用
 - **持久化应用名缓存**: 跨会话记住应用名称，加载更快
 - **批量操作**: 一键全选/全不选所有应用
 - **界面优化**: 现代化下拉菜单，更好的无障碍支持和移动端适配
 - **性能优化**: 快速初始加载，后台异步获取应用标签
 - **智能排序**: 已选应用自动置顶，便于管理
 - **增强视觉反馈**: 加载指示器和状态计数器
 - **稳健错误处理**: 更好的日志记录和错误恢复机制
 - 保存设置(需重启生效)

如何使用?

1. 确保设备已通过 [Magisk](https://topjohnwu.github.io/Magisk/install.html) 或 [KernelSU](https://kernelsu.org/guide/installation.html) 获取 Root。
2. 前往 [Releases](https://github.com/HoneyWhiteCloud/enable-hdr-oneplus13-webui/releases) 下载模块(enable-hdr-oneplus13-webui.zip)。
3. 在 Root 管理工具的 Modules 页面选择「从存储安装」。
4. 选择下载好的 zip 并安装。
5. 安装完成后重启设备即可生效。
6. 可选:通过 WebUI 自定义应用列表。

推荐magisk/Delta/Kitsune/KernelSU用户使用[WebUI-X-Portable](https://github.com/MMRLApp/WebUI-X-Portable)作为webui的管理器
SukiSU Ultra等可以变更webui引擎的则使用“自动选择”或者"强制使用WebUI X"



