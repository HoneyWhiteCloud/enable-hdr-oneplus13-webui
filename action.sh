#!/system/bin/sh

# 一键切换挂载方式
# 在 mountify standalone（模块自行处理挂载）和 元模块管理（依赖元模块进行挂载）之间切换

MODPATH="${0%/*}"
MODULE_VERSION="$(grep '^version=' "$MODPATH/module.prop" 2>/dev/null | cut -d'=' -f2)"

# 颜色定义（如果支持）
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    RED='\033[0;31m'
    NC='\033[0m' # No Color
else
    GREEN=''
    YELLOW=''
    BLUE=''
    RED=''
    NC=''
fi

# 检测当前挂载模式（静默）
detect_current_mode() {
    if [ -f "$MODPATH/skip_mount" ]; then
        echo "mountify"
    else
        echo "metamodule"
    fi
}

# 切换到 mountify 模式（静默）
switch_to_mountify() {
    touch "$MODPATH/skip_mount" 2>/dev/null
    touch "$MODPATH/skip_mountify" 2>/dev/null

    if [ ! -f "$MODPATH/skip_mount" ]; then
        return 1
    fi

    if [ ! -f "$MODPATH/mountify.sh" ]; then
        return 1
    fi

    if [ -f "$MODPATH/post-fs-data-mountify.sh" ]; then
        if cp "$MODPATH/post-fs-data-mountify.sh" "$MODPATH/post-fs-data.sh" 2>/dev/null; then
            chmod 0755 "$MODPATH/post-fs-data.sh" 2>/dev/null
        else
            return 1
        fi
    else
        return 1
    fi

    echo "mountify" > "$MODPATH/.mount_mode" 2>/dev/null
    return 0
}

# 切换到元模块模式（静默）
switch_to_metamodule() {
    rm -f "$MODPATH/skip_mount" 2>/dev/null
    rm -f "$MODPATH/skip_mountify" 2>/dev/null

    if [ -f "$MODPATH/skip_mount" ]; then
        return 1
    fi

    if [ -f "$MODPATH/post-fs-data-metamodule.sh" ]; then
        if cp "$MODPATH/post-fs-data-metamodule.sh" "$MODPATH/post-fs-data.sh" 2>/dev/null; then
            chmod 0755 "$MODPATH/post-fs-data.sh" 2>/dev/null
        else
            return 1
        fi
    else
        return 1
    fi

    echo "metamodule" > "$MODPATH/.mount_mode" 2>/dev/null
    return 0
}

# 执行切换
CURRENT_MODE=$(detect_current_mode)

if [ "$CURRENT_MODE" = "mountify" ]; then
    TARGET_MODE="metamodule"
    switch_to_metamodule
    result=$?
else
    TARGET_MODE="mountify"
    switch_to_mountify
    result=$?
fi

# 显示结果
clear
echo "=================================================="
echo "  HDR Module - Mount Mode Switcher"
echo "  HDR 模块 - 挂载模式切换器"
echo "  Module Version: ${MODULE_VERSION:-Unknown}"
echo "=================================================="
echo ""

if [ $result -eq 0 ]; then
    echo "${GREEN}✅ 切换成功！ / Switch Successful!${NC}"
    echo ""

    if [ "$TARGET_MODE" = "mountify" ]; then
        echo "${BLUE}📋 已切换为 / Switched to:${NC}"
        echo "   ${GREEN}mountify standalone（模块自行处理挂载）${NC}"
        echo ""
        echo "${BLUE}📝 模式说明 / Mode Description:${NC}"
        echo "   • 模块通过 mountify.sh 自行处理挂载"
        echo "   • Module handles mounting via mountify.sh"
        echo "   • 不依赖元模块（overlayfs/meta-overlayfs）"
        echo "   • No meta module dependency required"
        echo "   • 使用 overlayfs 技术自动挂载文件"
        echo "   • Uses overlayfs technology for mounting"
        echo "   • 适合没有安装元模块的用户"
        echo "   • Suitable for users without meta modules"
    else
        echo "${BLUE}📋 已切换为 / Switched to:${NC}"
        echo "   ${GREEN}元模块管理（依赖元模块进行挂载，模块不自动处理）${NC}"
        echo ""
        echo "${BLUE}📝 模式说明 / Mode Description:${NC}"
        echo "   • 模块依赖元模块处理挂载"
        echo "   • Module relies on meta module for mounting"
        echo "   • 需要安装元模块（overlayfs/meta-overlayfs 等）"
        echo "   • Requires meta module installation"
        echo "   • 模块仅提供文件，不自行处理挂载"
        echo "   • Module only provides files, no self-mounting"
        echo "   • 适合已安装元模块的用户"
        echo "   • Suitable for users with meta modules"
    fi

    echo ""
    echo "${YELLOW}⚠️  重要提示 / Important:${NC}"
    echo "   ${RED}• 必须重启设备才能使挂载模式生效${NC}"
    echo "   ${RED}• Must reboot device for changes to take effect${NC}"
else
    echo "${RED}❌ 切换失败！ / Switch Failed!${NC}"
    echo ""
    echo "${YELLOW}可能原因 / Possible Reasons:${NC}"
    echo "   • 模块文件不完整 / Module files incomplete"
    echo "   • 权限不足 / Insufficient permissions"
    echo "   • 模板文件缺失 / Template files missing"
    echo ""
    echo "${YELLOW}解决方法 / Solutions:${NC}"
    echo "   • 重新安装模块 / Reinstall the module"
    echo "   • 检查文件权限 / Check file permissions"
fi

echo "=================================================="
echo ""

exit $result
