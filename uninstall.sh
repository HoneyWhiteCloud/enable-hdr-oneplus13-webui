#!/system/bin/sh

# HDR OnePlus 13 WebUI - 智能卸载脚本
# 支持用户配置保留和完整清理
LOG_TAG="enable-hdr-oneplus13-webui"
MODPATH="${0%/*}"
MODULE_VERSION="$(grep '^version=' "$MODPATH/module.prop" 2>/dev/null | cut -d'=' -f2)"

log -t "$LOG_TAG" "Starting module uninstallation (v$MODULE_VERSION)"

# 用户配置保留检查
preserve_user_config() {
    local backup_dir="/data/local/tmp/hdr-webui-config-backup-$(date +%Y%m%d_%H%M%S)"
    local config_found=false
    local preserved_count=0

    # 检查是否存在有价值的用户配置
    if [ -f "$MODPATH/appList.xml" ] && [ -s "$MODPATH/appList.xml" ]; then
        config_found=true
    fi
    if [ -f "$MODPATH/appList_new.xml" ] && [ -s "$MODPATH/appList_new.xml" ]; then
        config_found=true
    fi
    if [ -f "$MODPATH/app_cache.json" ] && [ -s "$MODPATH/app_cache.json" ]; then
        config_found=true
    fi

    if [ "$config_found" = true ]; then
        log -t "$LOG_TAG" "Detected user configuration, creating backup..."
        mkdir -p "$backup_dir" 2>/dev/null

        # 保留用户配置文件
        for file in appList.xml appList_new.xml app_cache.json; do
            if [ -f "$MODPATH/$file" ] && [ -s "$MODPATH/$file" ]; then
                if cp "$MODPATH/$file" "$backup_dir/" 2>/dev/null; then
                    preserved_count=$((preserved_count + 1))
                fi
            fi
        done

        if [ $preserved_count -gt 0 ]; then
            echo "Backup created: $(date)" > "$backup_dir/README.txt"
            echo "Module version: $MODULE_VERSION" >> "$backup_dir/README.txt"
            echo "Files preserved: $preserved_count" >> "$backup_dir/README.txt"
            echo "To restore: Copy files back to module directory after reinstallation" >> "$backup_dir/README.txt"

            log -t "$LOG_TAG" "User config backed up to: $backup_dir"
            log -t "$LOG_TAG" "Preserved $preserved_count configuration files"
        else
            rm -rf "$backup_dir" 2>/dev/null
        fi
    fi
}

# 执行配置备份
preserve_user_config

# 清理模块文件
if [ -d "$MODPATH" ]; then
    # Remove WebUI generated cache files
    [ -f "$MODPATH/app_cache.json" ] && rm -f "$MODPATH/app_cache.json" && \
        log -t "$LOG_TAG" "Removed app cache file"
    [ -f "$MODPATH/app_cache.json.backup" ] && rm -f "$MODPATH/app_cache.json.backup" && \
        log -t "$LOG_TAG" "Removed app cache backup"

    # Remove WebUI log files
    find "$MODPATH" -name "*.log*" -type f -delete 2>/dev/null
    log -t "$LOG_TAG" "Cleaned up log files"

    # Remove application list files
    [ -f "$MODPATH/appList.xml" ] && rm -f "$MODPATH/appList.xml" && \
        log -t "$LOG_TAG" "Removed appList.xml"
    [ -f "$MODPATH/appList_new.xml" ] && rm -f "$MODPATH/appList_new.xml" && \
        log -t "$LOG_TAG" "Removed appList_new.xml"
    
    # Remove generated module config files
    [ -f "$MODPATH/multimedia_display_feature_config.xml" ] && rm -f "$MODPATH/multimedia_display_feature_config.xml" && \
        log -t "$LOG_TAG" "Removed generated feature config"
    [ -f "$MODPATH/multimedia_display_uir_config.xml" ] && rm -f "$MODPATH/multimedia_display_uir_config.xml" && \
        log -t "$LOG_TAG" "Removed generated UIR config"
    
    # Keep backup files intentionally (user may want to restore manually)
    if [ -d "$MODPATH/backup" ]; then
        log -t "$LOG_TAG" "Backup files preserved in $MODPATH/backup/"
    fi
    
    # Remove any temporary files created during operation
    find "$MODPATH" -name "*.tmp" -type f -delete 2>/dev/null && \
        log -t "$LOG_TAG" "Removed temporary files"
fi

# Remove temporary files in system temp directories
rm -rf /data/local/tmp/enable-hdr-oneplus13-webui* 2>/dev/null && \
    log -t "$LOG_TAG" "Cleaned up temp directory files"

# Remove any cached data in system directories
rm -rf /data/system/enable-hdr-oneplus13-webui* 2>/dev/null && \
    log -t "$LOG_TAG" "Cleaned up system cache files"

# Clean up any leftover WebUI cache in app data directories
rm -rf /data/data/*/cache/enable-hdr-oneplus13-webui* 2>/dev/null && \
    log -t "$LOG_TAG" "Cleaned up app cache directories"

# Clean up any KernelSU WebUI specific cache (if exists)
rm -rf /data/adb/ksu/*/cache/enable-hdr-oneplus13-webui* 2>/dev/null
rm -rf /data/adb/modules_update/enable-hdr-oneplus13-webui* 2>/dev/null

# Clean up old installation logs
rm -f /data/local/tmp/enable-hdr-oneplus13.txt 2>/dev/null && \
    log -t "$LOG_TAG" "Cleaned up installation logs"

# Reset any modified system files (if any bind mounts were used)
# Note: This is mainly precautionary as the module uses systemless modifications
if mount | grep -q "enable-hdr-oneplus13"; then
    log -t "$LOG_TAG" "Warning: Some bind mounts may still be active, reboot recommended"
fi

# Final cleanup verification
CLEANUP_COMPLETE=true

# Verify critical files are removed
for file in "$MODPATH/app_cache.json" "$MODPATH/webui.log" "$MODPATH/appList.xml" "$MODPATH/appList_new.xml" "$MODPATH/multimedia_display_feature_config.xml" "$MODPATH/multimedia_display_uir_config.xml" "/data/local/tmp/enable-hdr-oneplus13.txt"; do
    if [ -f "$file" ]; then
        log -t "$LOG_TAG" "Warning: Failed to remove $file"
        CLEANUP_COMPLETE=false
    fi
done

if [ "$CLEANUP_COMPLETE" = "true" ]; then
    log -t "$LOG_TAG" "All cleanup tasks completed successfully"
else
    log -t "$LOG_TAG" "Some cleanup tasks may have failed - manual cleanup may be required"
fi

# 生成卸载报告
generate_uninstall_report() {
    local report_file="/data/local/tmp/hdr-webui-uninstall-report.txt"

    {
        echo "========================================"
        echo "HDR OnePlus 13 WebUI - Uninstall Report"
        echo "========================================"
        echo "Date: $(date)"
        echo "Module version: $MODULE_VERSION"
        echo "Device: $(getprop ro.product.model)"
        echo "Android API: $(getprop ro.build.version.sdk)"
        echo ""
        echo "Cleanup completed:"
        echo "- Module directory: $MODPATH"
        echo "- Cache files: cleared"
        echo "- Log files: cleared"
        echo "- Generated configs: cleared"
        echo "- Temp files: cleared"
        echo ""
        echo "User configuration backup:"
        local backup_count=$(find /data/local/tmp -name "hdr-webui-config-backup-*" -type d 2>/dev/null | wc -l)
        if [ "$backup_count" -gt 0 ]; then
            echo "- Configuration backups created: $backup_count"
            echo "- Location: /data/local/tmp/hdr-webui-config-backup-*"
        else
            echo "- No user configuration found to backup"
        fi
        echo ""
        echo "Note: Reboot recommended to complete cleanup"
        echo "========================================"
    } > "$report_file" 2>/dev/null

    log -t "$LOG_TAG" "Uninstall report saved to: $report_file"
}

generate_uninstall_report

if [ "$CLEANUP_COMPLETE" = "true" ]; then
    log -t "$LOG_TAG" "All cleanup tasks completed successfully"
else
    log -t "$LOG_TAG" "Some cleanup tasks may have failed - check uninstall report"
fi

log -t "$LOG_TAG" "Module uninstallation completed"
log -t "$LOG_TAG" "Reboot recommended to ensure all changes are reverted"

exit 0