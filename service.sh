#!/system/bin/sh

# Magisk/KernelSU service script - runs after system boot
MODPATH="${0%/*}"
API=`getprop ro.build.version.sdk`
LOG_TAG="enable-hdr-oneplus13-webui"

# Log service start with version info
log -t "$LOG_TAG" "Service started (API: $API)"
log -t "$LOG_TAG" "Module path: $MODPATH"

# Ensure webui directory permissions are correct
if [ -d "$MODPATH/webroot" ]; then
    # 设置目录权限 (755 for directories, 644 for files)
    find "$MODPATH/webroot" -type d -exec chmod 755 {} \;
    find "$MODPATH/webroot" -type f -exec chmod 644 {} \;
    
    # 验证关键文件存在性
    if [ -f "$MODPATH/webroot/index.html" ] && [ -f "$MODPATH/webroot/scripts/main.js" ] && [ -f "$MODPATH/webroot/scripts/xml-merger.js" ]; then
        log -t "$LOG_TAG" "WebUI files verified and permissions set"
    else
        log -t "$LOG_TAG" "Warning: WebUI core files missing"
        # 检查具体缺失的文件
        [ ! -f "$MODPATH/webroot/index.html" ] && log -t "$LOG_TAG" "Missing: index.html"
        [ ! -f "$MODPATH/webroot/scripts/main.js" ] && log -t "$LOG_TAG" "Missing: main.js"
        [ ! -f "$MODPATH/webroot/scripts/xml-merger.js" ] && log -t "$LOG_TAG" "Missing: xml-merger.js"
    fi
else
    log -t "$LOG_TAG" "Error: WebUI directory not found at $MODPATH/webroot"
fi

# 设置 aapt 二进制文件的执行权限
if [ -d "$MODPATH/bin" ]; then
    # 设置bin目录权限
    chmod 755 "$MODPATH/bin"
    
    # 为所有架构的aapt设置执行权限
    for arch_dir in "$MODPATH/bin"/*; do
        if [ -d "$arch_dir" ]; then
            chmod 755 "$arch_dir"
            if [ -f "$arch_dir/aapt" ]; then
                chmod 755 "$arch_dir/aapt"
                log -t "enable-hdr-oneplus13-webui" "Set executable permission for $(basename "$arch_dir")/aapt"
            fi
        fi
    done
    
    log -t "enable-hdr-oneplus13-webui" "Binary permissions set"
fi

# 确保应用列表文件存在且可读
if [ ! -f "$MODPATH/appList.xml" ]; then
    # 创建默认的appList.xml (feature格式)
    cat > "$MODPATH/appList.xml" << 'EOF'
<application name="com.netflix.mediaclient"></application>
<application name="com.google.android.youtube"></application>
<application name="org.videolan.vlc"></application>
<application name="com.android.chrome"></application>
EOF
    chmod 644 "$MODPATH/appList.xml"
    log -t "$LOG_TAG" "Created default appList.xml"
fi

# 确保appList_new.xml存在（新架构需要）
if [ ! -f "$MODPATH/appList_new.xml" ]; then
    # 创建默认的appList_new.xml (UIR格式)
    cat > "$MODPATH/appList_new.xml" << 'EOF'
<app>com.netflix.mediaclient</app>
<app>com.google.android.youtube</app>
<app>org.videolan.vlc</app>
<app>com.android.chrome</app>
EOF
    chmod 644 "$MODPATH/appList_new.xml"
    log -t "$LOG_TAG" "Created default appList_new.xml"
fi


# 确保缓存和日志文件权限正确
CACHE_FILE="$MODPATH/app_cache.json"
LOG_FILE="$MODPATH/webui.log"

# 初始化缓存文件
if [ ! -f "$CACHE_FILE" ]; then
    # 创建空的缓存文件 - 与 WebUI 格式一致
    echo '{}' > "$CACHE_FILE" 2>/dev/null
    if [ $? -eq 0 ]; then
        chmod 644 "$CACHE_FILE"
        log -t "$LOG_TAG" "Created app cache file: $CACHE_FILE"
    else
        log -t "$LOG_TAG" "Warning: Failed to create app cache file"
    fi
else
    # 验证缓存文件格式并设置权限
    if [ -s "$CACHE_FILE" ]; then
        # 检查是否为有效 JSON (简单验证)
        if head -c 1 "$CACHE_FILE" | grep -q '[{]'; then
            chmod 644 "$CACHE_FILE"
            log -t "$LOG_TAG" "App cache file validated and permissions set"
        else
            # 备份并重新创建损坏的缓存文件
            mv "$CACHE_FILE" "$CACHE_FILE.backup" 2>/dev/null
            echo '{}' > "$CACHE_FILE" 2>/dev/null && chmod 644 "$CACHE_FILE"
            log -t "$LOG_TAG" "Corrupted cache file reset, backup created"
        fi
    else
        chmod 644 "$CACHE_FILE"
        log -t "$LOG_TAG" "Empty cache file permissions set"
    fi
fi

# 清理旧日志并确保日志文件可写
if [ -f "$LOG_FILE" ]; then
    # 如果日志文件过大（>1MB），轮转它
    if [ $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 1048576 ]; then
        mv "$LOG_FILE" "$LOG_FILE.old" 2>/dev/null
        log -t "$LOG_TAG" "Log file rotated due to size"
    fi
fi

# 测试日志文件写入权限
touch "$LOG_FILE" 2>/dev/null && rm -f "$LOG_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    log -t "$LOG_TAG" "Log directory is writable"
else
    log -t "$LOG_TAG" "Warning: Log directory may not be writable"
fi

# 最终状态报告
log -t "$LOG_TAG" "=== Module Setup Complete ==="
log -t "$LOG_TAG" "WebUI: $MODPATH/webroot/"
log -t "$LOG_TAG" "AppList (feature): $MODPATH/appList.xml"
log -t "$LOG_TAG" "AppList (UIR): $MODPATH/appList_new.xml"
log -t "$LOG_TAG" "XML Merger: $MODPATH/webroot/scripts/xml-merger.js"
log -t "$LOG_TAG" "Cache: $CACHE_FILE"
log -t "$LOG_TAG" "Logs: $LOG_FILE"
log -t "$LOG_TAG" "Binary tools: $MODPATH/bin/"
log -t "$LOG_TAG" "Service initialization completed successfully"

exit 0