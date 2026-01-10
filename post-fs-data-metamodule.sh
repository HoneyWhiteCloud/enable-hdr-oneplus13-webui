#!/system/bin/sh

# 此脚本在文件系统挂载后运行
# 依赖元模块管理挂载，模块不自己处理挂载
# XML 处理由 WebUI 的 JavaScript 完成

MODPATH="$(dirname "$(realpath "$0")")" # 模块目录路径
BACKUP_DIR="$MODPATH/backup" # 备份目录

# 调试日志
log_file="$MODPATH/log.txt"

# 模块信息
MODULE_VERSION="$(grep '^version=' "$MODPATH/module.prop" 2>/dev/null | cut -d'=' -f2)"

# 日志记录函数
log_msg() {
    local level="$1"
    shift
    local msg="$*"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $msg" >> "$log_file"
}

# 初始化日志文件
if [ -f "$log_file" ]; then
    rm "$log_file" 2>/dev/null || true
fi

# 开始记录新的执行日志
log_msg "START" "======== post-fs-data.sh 开始执行 ========"
log_msg "INFO" "模块版本: ${MODULE_VERSION:-unknown}"
log_msg "INFO" "模块路径: $MODPATH"
log_msg "INFO" "Android API: $(getprop ro.build.version.sdk)"
log_msg "INFO" "设备品牌: $(getprop ro.product.brand)"
log_msg "INFO" "制造商: $(getprop ro.product.manufacturer)"

##########################################################################################
# 元模块管理挂载模式
##########################################################################################

log_msg "MOUNT" "======== 依赖元模块管理挂载 ========"
log_msg "MOUNT" "模块不自行处理挂载，由元模块（overlayfs/meta-overlayfs 等）负责"
log_msg "MOUNT" "模块文件放置在 system/ 目录，由 root 管理器和元模块自动处理"

##########################################################################################
# 用户配置恢复逻辑 - 从 /data/adb 临时目录恢复
##########################################################################################

MODULE_ID="enable-hdr-oneplus13-webui"
TEMP_CONFIG_DIR="/data/adb/temp_config_$MODULE_ID"

# 检查临时配置目录是否存在
if [ -d "$TEMP_CONFIG_DIR" ]; then
    log_msg "CONFIG" "检测到临时配置目录: $TEMP_CONFIG_DIR"

    # 检查目录是否非空且包含有效文件
    if [ -f "$TEMP_CONFIG_DIR/.preserve_timestamp" ]; then
        preserve_time=$(cat "$TEMP_CONFIG_DIR/.preserve_timestamp" 2>/dev/null)
        module_version=$(cat "$TEMP_CONFIG_DIR/.module_version" 2>/dev/null)
        file_count=$(cat "$TEMP_CONFIG_DIR/.file_count" 2>/dev/null)

        log_msg "CONFIG" "配置保存信息 - 时间: $preserve_time, 版本: $module_version, 文件数: $file_count"

        # 恢复 WebUI 生成的配置文件
        restored_count=0

        # 恢复用户应用列表文件
        for config_file in appList.xml appList_new.xml app_cache.json; do
            if [ -f "$TEMP_CONFIG_DIR/$config_file" ]; then
                if cp "$TEMP_CONFIG_DIR/$config_file" "$MODPATH/" 2>/dev/null; then
                    chmod 644 "$MODPATH/$config_file" 2>/dev/null
                    restored_count=$((restored_count + 1))

                    # 记录恢复详情
                    case "$config_file" in
                        "appList.xml")
                            app_count=$(grep -c '<application name=' "$MODPATH/$config_file" 2>/dev/null || echo 0)
                            log_msg "CONFIG" "已恢复用户应用列表(legacy): $config_file ($app_count apps)"
                            ;;
                        "appList_new.xml")
                            app_count=$(grep -c '<app>' "$MODPATH/$config_file" 2>/dev/null || echo 0)
                            log_msg "CONFIG" "已恢复用户应用列表(new): $config_file ($app_count apps)"
                            ;;
                        "app_cache.json")
                            cache_size=$(wc -c < "$MODPATH/$config_file" 2>/dev/null || echo 0)
                            log_msg "CONFIG" "已恢复应用缓存: $config_file (${cache_size} bytes)"
                            ;;
                    esac
                else
                    log_msg "WARN" "恢复配置文件失败: $config_file"
                fi
            fi
        done

        # 恢复 WebUI 生成的系统配置文件 (如果存在)
        for sys_config in "multimedia_display_feature_config.xml" "multimedia_display_uir_config.xml"; do
            if [ -f "$TEMP_CONFIG_DIR/$sys_config" ]; then
                if cp "$TEMP_CONFIG_DIR/$sys_config" "$MODPATH/" 2>/dev/null; then
                    chmod 644 "$MODPATH/$sys_config" 2>/dev/null
                    restored_count=$((restored_count + 1))
                    log_msg "CONFIG" "已恢复系统配置: $sys_config"
                else
                    log_msg "WARN" "恢复系统配置失败: $sys_config"
                fi
            fi
        done

        # 验证恢复结果
        if [ $restored_count -gt 0 ]; then
            log_msg "SUCCESS" "WebUI 配置恢复完成，恢复文件数: $restored_count"

            # 验证恢复的文件格式完整性
            if [ -f "$MODPATH/app_cache.json" ]; then
                if ! head -c 1 "$MODPATH/app_cache.json" | grep -q '[{]' 2>/dev/null; then
                    log_msg "WARN" "app_cache.json 格式异常，重置为空JSON对象"
                    echo '{}' > "$MODPATH/app_cache.json" 2>/dev/null
                    chmod 644 "$MODPATH/app_cache.json" 2>/dev/null
                else
                    cache_entries=$(grep -o '"[^"]*":' "$MODPATH/app_cache.json" 2>/dev/null | wc -l)
                    log_msg "CONFIG" "应用缓存验证通过: $cache_entries 个条目"
                fi
            fi

            # 验证应用列表格式
            if [ -f "$MODPATH/appList.xml" ]; then
                if ! grep -q '<application name=' "$MODPATH/appList.xml" 2>/dev/null; then
                    log_msg "WARN" "appList.xml 格式可能异常"
                fi
            fi

            if [ -f "$MODPATH/appList_new.xml" ]; then
                if ! grep -q '<app>' "$MODPATH/appList_new.xml" 2>/dev/null; then
                    log_msg "WARN" "appList_new.xml 格式可能异常"
                fi
            fi

            # 清理临时目录
            if rm -rf "$TEMP_CONFIG_DIR" 2>/dev/null; then
                log_msg "CONFIG" "临时配置目录清理完成"
            else
                log_msg "WARN" "临时配置目录清理失败"
            fi
        else
            log_msg "ERROR" "未能恢复任何配置文件"
        fi
    else
        log_msg "WARN" "临时目录存在但缺少标识文件，可能是残留目录"
        # 清理可能的残留目录
        rm -rf "$TEMP_CONFIG_DIR" 2>/dev/null
    fi
else
    log_msg "CONFIG" "未检测到临时配置目录，跳过配置恢复"
fi

##########################################################################################
# 备份原始文件
##########################################################################################

# 目标文件
TARGET_FILE="/my_product/vendor/etc/multimedia_display_feature_config.xml"
BACKUP_FILE="$BACKUP_DIR/multimedia_display_feature_config.xml"

TARGET_FILE_NEW="/my_product/vendor/etc/multimedia_display_uir_config.xml"
BACKUP_FILE_NEW="$BACKUP_DIR/multimedia_display_uir_config.xml"

# 创建备份目录（如果不存在）
log_msg "INFO" "创建备份目录"
if mkdir -p "$BACKUP_DIR" 2>/dev/null; then
    log_msg "SUCCESS" "备份目录创建成功"
else
    log_msg "ERROR" "备份目录创建失败"
fi

# 备份原始文件（仅在备份不存在且原文件存在时执行）
log_msg "INFO" "检查并备份原始文件"

# 备份 multimedia_display_feature_config.xml
if [ ! -f "$BACKUP_FILE" ] && [ -f "$TARGET_FILE" ]; then
    log_msg "INFO" "备份 multimedia_display_feature_config.xml"
    if cp "$TARGET_FILE" "$BACKUP_FILE" 2>/dev/null; then
        log_msg "SUCCESS" "multimedia_display_feature_config.xml 备份成功"
    else
        log_msg "ERROR" "multimedia_display_feature_config.xml 备份失败"
    fi
else
    log_msg "INFO" "multimedia_display_feature_config.xml 备份跳过"
fi

# 备份 multimedia_display_uir_config.xml
if [ ! -f "$BACKUP_FILE_NEW" ] && [ -f "$TARGET_FILE_NEW" ]; then
    log_msg "INFO" "备份 multimedia_display_uir_config.xml"
    if cp "$TARGET_FILE_NEW" "$BACKUP_FILE_NEW" 2>/dev/null; then
        log_msg "SUCCESS" "multimedia_display_uir_config.xml 备份成功"
    else
        log_msg "ERROR" "multimedia_display_uir_config.xml 备份失败"
    fi
else
    log_msg "INFO" "multimedia_display_uir_config.xml 备份跳过"
fi

##########################################################################################
# 验证和最终状态
##########################################################################################

# 验证WebUI关键文件完整性
log_msg "INFO" "检查WebUI核心文件"
webui_files="$MODPATH/webroot/index.html $MODPATH/webroot/scripts/main.js $MODPATH/webroot/scripts/xml-merger.js"
webui_ok=true

for webui_file in $webui_files; do
    if [ ! -f "$webui_file" ]; then
        log_msg "WARN" "WebUI关键文件缺失: $webui_file"
        webui_ok=false
    fi
done

if [ "$webui_ok" = true ]; then
    log_msg "SUCCESS" "WebUI核心文件验证通过"
else
    log_msg "ERROR" "WebUI文件不完整，可能影响功能"
fi

# 检查用户配置文件状态
if [ -f "$MODPATH/appList.xml" ] || [ -f "$MODPATH/appList_new.xml" ]; then
    log_msg "INFO" "检测到用户配置文件"
    [ -f "$MODPATH/appList.xml" ] && log_msg "DEBUG" "appList.xml 大小: $(wc -c < "$MODPATH/appList.xml") 字节"
    [ -f "$MODPATH/appList_new.xml" ] && log_msg "DEBUG" "appList_new.xml 大小: $(wc -c < "$MODPATH/appList_new.xml") 字节"
else
    log_msg "INFO" "未检测到用户配置，将使用默认设置"
fi

# 检查模块配置文件是否存在
if [ -f "$MODPATH/multimedia_display_feature_config.xml" ]; then
    feature_size=$(wc -c < "$MODPATH/multimedia_display_feature_config.xml" 2>/dev/null || echo "0")
    log_msg "FINAL" "功能配置文件大小: $feature_size 字节"
fi

if [ -f "$MODPATH/multimedia_display_uir_config.xml" ]; then
    uir_size=$(wc -c < "$MODPATH/multimedia_display_uir_config.xml" 2>/dev/null || echo "0")
    log_msg "FINAL" "UIR配置文件大小: $uir_size 字节"
fi

log_msg "INFO" "XML处理逻辑已移至WebUI，请通过WebUI界面进行文件合并操作"
log_msg "END" "======== post-fs-data.sh 执行结束 ========"

# 始终成功退出以避免启动失败
exit 0
