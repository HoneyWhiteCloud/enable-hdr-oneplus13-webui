# 更新日志 / Changelog

## v1.6.0 (当前版本 / Current Version)

### 🚀 重大改进 / Major Improvements
- **智能冲突检测系统** - 保护原有应用的特殊HDR参数配置
- **WebUI-X-Portable 兼容性** - 完美支持更快的WebUI管理器
- **状态栏遮挡修复** - 兼容两种主流WebUI管理器的显示问题

### ✨ 新增功能 / New Features
- **UIR配置智能处理** - 避免重复添加应用，保持XML格式一致性
- **动态缩进检测** - 自动适应原文件的缩进格式
- **非阻塞式应用加载** - 搜索框立即可用，提升用户体验
- **增强的备份机制** - 安全的文件修改策略

### 🔧 技术优化 / Technical Optimizations
- **双配置文件支持** - HDR和UIR配置分离管理
- **改进的日志系统** - 详细的操作追踪和错误处理
- **完整的生命周期管理** - 安装、运行、卸载全流程优化

### 🐛 问题修复 / Bug Fixes
- 修复了tv.danmaku.bili等应用HDR激发失败的问题
- 解决了WebUI应用名称获取时的搜索框阻塞问题
- 修复了XML文件重复应用条目的问题
- 改善了模块卸载时的清理不完整问题

### 📱 兼容性 / Compatibility
- **推荐**: WebUI-X-Portable (性能更佳)
- **支持**: KsuWebUI-Standalone (经典选择)
- **系统**: Android 11+ / API 30+
- **Root**: Magisk 25.0+ / KernelSU 0.7.0+

---

## 贡献者 / Contributors
- **Oxford** - 核心算法和系统集成
- **HoneyWhiteCloud** - WebUI开发和用户体验优化  
- **FTReey@coolapk** - 测试反馈和兼容性改进

---

## 使用说明 / Usage Instructions

1. 安装模块后重启设备
2. 下载推荐的WebUI管理器：
   - 🚀 **WebUI-X-Portable**: https://github.com/MMRLApp/WebUI-X-Portable/releases
   - 📱 **KsuWebUI-Standalone**: https://github.com/5ec1cff/KsuWebUIStandalone/releases
3. 授予ROOT权限并访问模块WebUI界面
4. 选择需要启用HDR的应用，保存配置后重启

## 支持与反馈 / Support & Feedback

- **GitHub Issues**: https://github.com/HoneyWhiteCloud/enable-hdr-oneplus13-webui/issues
- **项目主页**: https://github.com/HoneyWhiteCloud/enable-hdr-oneplus13-webui
- **适用设备**: OnePlus 13 及兼容设备