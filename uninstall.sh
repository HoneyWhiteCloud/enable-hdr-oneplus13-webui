#!/system/bin/sh

# Enhanced cleanup script for module uninstallation
LOG_TAG="enable-hdr-oneplus13-webui"
MODPATH="${0%/*}"

log -t "$LOG_TAG" "Starting comprehensive module cleanup"

# Clean up module-specific files in module directory
if [ -d "$MODPATH" ]; then
    # Remove WebUI generated cache files
    [ -f "$MODPATH/app_cache.json" ] && rm -f "$MODPATH/app_cache.json" && \
        log -t "$LOG_TAG" "Removed app cache file"
    [ -f "$MODPATH/app_cache.json.backup" ] && rm -f "$MODPATH/app_cache.json.backup" && \
        log -t "$LOG_TAG" "Removed app cache backup"
    
    # Remove WebUI log files
    [ -f "$MODPATH/webui.log" ] && rm -f "$MODPATH/webui.log" && \
        log -t "$LOG_TAG" "Removed WebUI log file"
    [ -f "$MODPATH/webui.log.old" ] && rm -f "$MODPATH/webui.log.old" && \
        log -t "$LOG_TAG" "Removed old WebUI log file"
    
    # Remove module log files
    [ -f "$MODPATH/log.txt" ] && rm -f "$MODPATH/log.txt" && \
        log -t "$LOG_TAG" "Removed module log file"
    
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

log -t "$LOG_TAG" "Module cleanup completed successfully"
log -t "$LOG_TAG" "Reboot recommended to ensure all changes are reverted"

exit 0