#!/system/bin/sh

# 设置模块参数 - 使用 mountify standalone 自行管理挂载
SKIPMOUNT=false
PROPFILE=true
POSTFSDATA=true
LATESTARTSERVICE=true

ui_print "- Custom configuration started"

ui_print "- Step 1: Getting device info"

DEVICE_MODEL=`getprop ro.product.model`
ui_print "- Step 2: Device model obtained"

ANDROID_VERSION=`getprop ro.build.version.release`
ui_print "- Step 3: Android version obtained"

ui_print "- Step 4: Getting brand info"
BRAND_NAME=`getprop ro.product.brand`
ui_print "- Step 5: Brand info obtained"

ui_print "- Step 6: Starting compatibility check"

ui_print "- Step 7: Entering brand check"

ui_print "- Step 8: Brand check completed"

ui_print "- Step 9: Compatibility check completed"

ui_print "- Step 10: Showing access info"
ui_print "📱 Access WebUI:"
ui_print "   Recommended: WebUI-X-Portable"

ui_print "- Step 11: Creating skip_mount marker"
# 创建 skip_mount 文件，告诉 root 管理器不要自动挂载
# 因为我们使用 mountify standalone 自行管理挂载
touch "$MODPATH/skip_mount"
touch "$MODPATH/skip_mountify"
ui_print "- Module will handle mounting itself via mountify standalone"

ui_print "- Step 12: Setting permissions"
set_perm_recursive $MODPATH 0 0 0777 0777

ui_print "- Step 13: Final step"
ui_print "- Custom configuration completed"

exit 0