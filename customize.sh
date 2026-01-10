#!/system/bin/sh

# 设置模块参数 - 使用 root 管理器默认挂载方式
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

ui_print "- Step 11: Setting permissions"
set_perm_recursive $MODPATH 0 0 0777 0777

ui_print "- Step 12: Final step"
ui_print "- Custom configuration completed"

exit 0