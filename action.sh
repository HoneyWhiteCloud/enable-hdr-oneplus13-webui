#!/system/bin/sh

MODPATH="${0%/*}"
MODULE_VERSION="$(grep '^version=' "$MODPATH/module.prop" 2>/dev/null | cut -d'=' -f2)"
DEVICE_MODEL="$(getprop ro.product.model)"
ANDROID_VERSION="$(getprop ro.build.version.release)"
ANDROID_API="$(getprop ro.build.version.sdk)"

echo "=================================================="
echo "  ColorOS/OxygenOS HDR WebUI Management Tool"
echo "  Module Version: ${MODULE_VERSION:-Unknown}"
echo "  Compatible: OnePlus/OPPO/realme devices"
echo "=================================================="
echo ""

echo "📱 System Information / 系统信息："
echo "   Device / 设备: $DEVICE_MODEL"
echo "   Android Version / 安卓版本: $ANDROID_VERSION (API $ANDROID_API)"

# 设备兼容性检查 (ColorOS/OxygenOS系统)
BRAND_NAME="$(getprop ro.product.brand | tr '[:upper:]' '[:lower:]')"
MANUFACTURER="$(getprop ro.product.manufacturer | tr '[:upper:]' '[:lower:]')"

if echo "$BRAND_NAME $MANUFACTURER $DEVICE_MODEL" | grep -qiE "(oneplus|oppo|realme)"; then
    if echo "$DEVICE_MODEL" | grep -qi "oneplus"; then
        echo "   🎯 OnePlus device - Optimal compatibility / OnePlus 设备 - 最佳兼容性"
        if echo "$DEVICE_MODEL" | grep -qi "13"; then
            echo "      OnePlus 13 detected - Primary target device / 检测到 OnePlus 13 - 主要目标设备"
        fi
    elif echo "$BRAND_NAME $MANUFACTURER" | grep -qi "oppo"; then
        echo "   ✅ OPPO device - ColorOS HDR system compatible / OPPO 设备 - ColorOS HDR 系统兼容"
    elif echo "$BRAND_NAME $MANUFACTURER" | grep -qi "realme"; then
        echo "   ✅ realme device - ColorOS-based HDR compatible / realme 设备 - 基于 ColorOS HDR 兼容"
    fi
    echo "      HDR whitelist mechanism supported / 支持 HDR 白名单机制"
else
    echo "   ⚠️  Non-ColorOS/OxygenOS device / 非 ColorOS/OxygenOS 设备"
    echo "      Module may not work as expected / 模块可能无法正常工作"
    echo "      Designed for OnePlus/OPPO/realme devices / 专为 OnePlus/OPPO/realme 设备设计"
fi

# Android版本检查
if [ "$ANDROID_API" -ge 28 ]; then
    echo "   ✅ Android version compatible / Android 版本兼容"
else
    echo "   ⚠️  Android version may be too old / Android 版本可能过旧"
fi

echo ""

echo "📱 For Magisk Users / Magisk 用户："
echo ""
echo "⚠️  IMPORTANT / 重要提醒："
echo "   Magisk Manager only shows 'Action' button, not 'WebUI'"
echo "   Magisk 管理器只显示"操作"按钮，没有 WebUI 按钮"
echo "   You need to use WebUI-X-Portable for WebUI access (RECOMMENDED)"
echo "   您需要使用 WebUI-X-Portable 来访问 WebUI（推荐）"
echo ""

echo "🎯 How to Access WebUI / 如何访问 WebUI："
echo ""
echo "🚀 RECOMMENDED - WebUI-X-Portable (Faster performance):"
echo "   📥 推荐下载 - WebUI-X-Portable（性能更快）:"
echo "   https://github.com/MMRLApp/WebUI-X-Portable/releases"
echo "   💡 Supports both KernelSU and Magisk"
echo "      支持 KernelSU 和 Magisk"
echo ""
echo "📱 Alternative - KsuWebUI-Standalone:"
echo "   备选下载 - KsuWebUI-Standalone:"
echo "   https://github.com/5ec1cff/KsuWebUIStandalone/releases/download/v1.0/KsuWebUI-1.0-34-release.apk"
echo ""
echo "2️⃣  Install the APK file / 安装 APK 文件"
echo ""
echo "3️⃣  ⚠️  CRITICAL: Grant ROOT permissions to this app"
echo "   ⚠️  关键步骤：授予此应用 ROOT 权限"
echo "   (Required for reading/writing module files)"
echo "   （需要读写模块文件）"
echo ""
echo "4️⃣  Open the app and navigate to this module's WebUI"
echo "   打开应用并导航到此模块的 WebUI"
echo ""

echo "📱 Enhanced WebUI Features (v1.6.6) / 增强版 WebUI 功能 (v1.6.6)："
echo "   • ✨ Real-time app list saving (no manual save needed)"
echo "     实时应用列表保存（无需手动保存）"
echo "   • 🔍 Smart real-time search and filtering"
echo "     智能实时搜索和过滤"
echo "   • 💾 Persistent app name caching"
echo "     持久化应用名称缓存"
echo "   • 📦 Batch select/deselect operations"
echo "     批量选择/取消选择操作"
echo "   • ⚡ Optimized performance and loading"
echo "     优化性能和加载速度"
echo "   • 📱 Enhanced mobile-friendly interface"
echo "     增强移动端友好界面"
echo "   • 🛡️ Comprehensive error handling"
echo "     全面的错误处理机制"
echo ""

# 模块状态检查
echo "🔧 Module Status Check / 模块状态检查："
echo ""

# 检查关键文件
check_files() {
    local missing_files=0
    local critical_files="webroot/index.html webroot/scripts/main.js webroot/scripts/xml-merger.js"

    for file in $critical_files; do
        if [ -f "$MODPATH/$file" ]; then
            echo "   ✅ $file"
        else
            echo "   ❌ Missing: $file"
            missing_files=$((missing_files + 1))
        fi
    done

    # 检查 WebUI 生成的用户配置
    echo "   📂 WebUI Generated Configurations:"
    local config_found=false

    if [ -f "$MODPATH/appList.xml" ] && [ -s "$MODPATH/appList.xml" ]; then
        local app_count=$(grep -c '<application name=' "$MODPATH/appList.xml" 2>/dev/null || echo 0)
        if [ "$app_count" -gt 0 ]; then
            echo "      📋 User app list (legacy): $app_count apps"
            config_found=true
        fi
    fi

    if [ -f "$MODPATH/appList_new.xml" ] && [ -s "$MODPATH/appList_new.xml" ]; then
        local app_count=$(grep -c '<app>' "$MODPATH/appList_new.xml" 2>/dev/null || echo 0)
        if [ "$app_count" -gt 0 ]; then
            echo "      📋 User app list (new): $app_count apps"
            config_found=true
        fi
    fi

    if [ -f "$MODPATH/app_cache.json" ] && [ -s "$MODPATH/app_cache.json" ]; then
        if head -c 1 "$MODPATH/app_cache.json" | grep -q '[{]' 2>/dev/null; then
            local cache_entries=$(grep -o '"[^"]*":' "$MODPATH/app_cache.json" 2>/dev/null | wc -l)
            if [ "$cache_entries" -gt 0 ]; then
                echo "      📋 App name cache: $cache_entries entries"
                config_found=true
            fi
        fi
    fi

    # 检查系统配置文件
    for sys_config in "multimedia_display_feature_config.xml" "multimedia_display_uir_config.xml"; do
        if [ -f "$MODPATH/$sys_config" ] && [ -s "$MODPATH/$sys_config" ]; then
            echo "      📋 System config: $sys_config"
            config_found=true
        fi
    done

    if [ "$config_found" = false ]; then
        echo "      ℹ️  No WebUI configurations found"
        echo "         (Configure apps via WebUI to generate config files)"
    fi

    if [ $missing_files -eq 0 ]; then
        echo "   🎉 All critical files present / 所有关键文件完整"
    else
        echo "   ⚠️  $missing_files critical files missing / $missing_files 个关键文件缺失"
        echo "      Reinstall may be required / 可能需要重新安装"
    fi
}

check_files
echo ""

# 故障排除信息
echo "🛠️  Troubleshooting Guide / 故障排除指南："
echo ""
echo "Common Issues / 常见问题："
echo ""
echo "1️⃣  WebUI not accessible / WebUI 无法访问:"
echo "   • Ensure WebUI app has ROOT permissions"
echo "     确保 WebUI 应用已获得 ROOT 权限"
echo "   • Check if module is enabled in manager"
echo "     检查模块是否在管理器中启用"
echo "   • Try restarting WebUI app"
echo "     尝试重启 WebUI 应用"
echo ""

echo "2️⃣  HDR not working for apps / 应用 HDR 不生效:"
echo "   • Check app list configuration in WebUI"
echo "     在 WebUI 中检查应用列表配置"
echo "   • Ensure apps are properly selected"
echo "     确保应用已正确选择"
echo "   • Restart apps after configuration"
echo "     配置后重启应用"
echo ""

echo "3️⃣  Module logs / 模块日志:"
echo "   • WebUI log: $MODPATH/webui.log"
echo "   • Module log: $MODPATH/log.txt"
echo "   • System log: logcat | grep 'enable-hdr'"
echo ""

echo "📞 Support / 技术支持:"
echo "   • GitHub Issues (preferred): Report detailed logs"
echo "     GitHub Issues (推荐): 提交详细日志"
echo "   • Include device model and Android version"
echo "     包含设备型号和 Android 版本"
echo ""

echo "✨ Follow the steps above to access WebUI."
echo "请按照上述步骤访问 WebUI。"

# 检查是否需要重启
if [ ! -f "/data/local/tmp/.hdr_webui_configured" ]; then
    echo ""
    echo "💡 Tip: If this is first installation, reboot is recommended"
    echo "提示：如果是首次安装，建议重启设备"
fi

exit 0