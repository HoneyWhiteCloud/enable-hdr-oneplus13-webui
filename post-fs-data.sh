#!/system/bin/sh

# 此脚本在文件系统挂载后运行
# 简化版本：只负责备份原始文件和挂载模块文件
# XML 处理由 WebUI 的 JavaScript 完成

MODPATH="$(dirname "$(realpath "$0")")" # 模块目录路径
BACKUP_DIR="$MODPATH/backup" # 备份目录
SYSTEM_DIR="$MODPATH/system/my_product/vendor/etc" # Magic Mount 目录

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

# 目标文件和模块文件
TARGET_FILE="/my_product/vendor/etc/multimedia_display_feature_config.xml"
BACKUP_FILE="$BACKUP_DIR/multimedia_display_feature_config.xml"
MODULE_FILE="$MODPATH/multimedia_display_feature_config.xml"
SYSTEM_MOUNT_FILE="$SYSTEM_DIR/multimedia_display_feature_config.xml"

TARGET_FILE_NEW="/my_product/vendor/etc/multimedia_display_uir_config.xml"
BACKUP_FILE_NEW="$BACKUP_DIR/multimedia_display_uir_config.xml"
MODULE_FILE_NEW="$MODPATH/multimedia_display_uir_config.xml"
SYSTEM_MOUNT_FILE_NEW="$SYSTEM_DIR/multimedia_display_uir_config.xml"

##########################################################################################
# 环境检测 - 判断使用哪种挂载方式
##########################################################################################

# 检测是否为 Magisk 环境
is_magisk() {
    if [ -n "$MAGISK_VER" ] || [ -n "$MAGISK_VER_CODE" ]; then
        return 0
    fi
    if [ -f "/data/adb/magisk/util_functions.sh" ]; then
        return 0
    fi
    return 1
}

# 检测是否为 KernelSU 环境
is_kernelsu() {
    if [ -n "$KSU" ] || [ -n "$KERNELSU" ]; then
        return 0
    fi
    if [ -f "/data/adb/ksu/bin/ksud" ]; then
        return 0
    fi
    return 1
}

# 检测是否有 KernelSU 元模块
has_metamodule() {
    # 检查是否有元模块在运行
    if [ -d "/data/adb/modules" ]; then
        # 检查已知的元模块
        for meta in "overlayfs" "meta-overlayfs" "meta-hybrid" "meta_hybrid_mount"; do
            local meta_path="/data/adb/modules/$meta"
            if [ -d "$meta_path" ] && [ ! -f "$meta_path/disable" ] && [ ! -f "$meta_path/remove" ]; then
                log_msg "META" "检测到元模块: $meta"
                return 0
            fi
        done
    fi
    return 1
}

# 决定挂载策略
determine_mount_strategy() {
    local strategy="unknown"

    if is_magisk; then
        strategy="magic_mount"
        log_msg "ENV" "检测到 Magisk 环境，使用 Magic Mount"
    elif is_kernelsu; then
        if has_metamodule; then
            strategy="magic_mount"
            log_msg "ENV" "检测到 KernelSU + 元模块，使用 Magic Mount"
        else
            strategy="manual_mount"
            log_msg "ENV" "检测到 KernelSU 无元模块，使用手动挂载"
        fi
    else
        # 未知环境，尝试手动挂载
        strategy="manual_mount"
        log_msg "ENV" "未知环境，尝试手动挂载"
    fi

    echo "$strategy"
}

# 初始化日志文件
if [ -f "$log_file" ]; then
    rm "$log_file" 2>/dev/null || true
fi

# 开始记录新的执行日志
log_msg "START" "======== post-fs-data.sh 开始执行 ========"
log_msg "INFO" "模块版本: ${MODULE_VERSION:-unknown}"
log_msg "INFO" "模块路径: $MODPATH"
log_msg "INFO" "备份目录: $BACKUP_DIR"
log_msg "INFO" "Android API: $(getprop ro.build.version.sdk)"
log_msg "INFO" "设备品牌: $(getprop ro.product.brand)"
log_msg "INFO" "制造商: $(getprop ro.product.manufacturer)"

# 检测环境并确定挂载策略
MOUNT_STRATEGY=$(determine_mount_strategy)
log_msg "STRATEGY" "挂载策略: $MOUNT_STRATEGY"

# 创建 system 目录（Magic Mount 需要）
if [ "$MOUNT_STRATEGY" = "magic_mount" ]; then
    if mkdir -p "$SYSTEM_DIR" 2>/dev/null; then
        log_msg "INFO" "Magic Mount 目录创建成功: $SYSTEM_DIR"
    else
        log_msg "WARN" "Magic Mount 目录创建失败，尝试继续"
    fi
fi

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

# 创建备份目录（如果不存在）
log_msg "INFO" "创建备份目录"
if mkdir -p "$BACKUP_DIR" 2>/dev/null; then
    log_msg "SUCCESS" "备份目录创建成功"
else
    log_msg "ERROR" "备份目录创建失败"
    exit 1
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
    log_msg "DEBUG" "备份文件存在: $([ -f "$BACKUP_FILE" ] && echo "是" || echo "否")"
    log_msg "DEBUG" "原文件存在: $([ -f "$TARGET_FILE" ] && echo "是" || echo "否")"
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
    log_msg "DEBUG" "备份文件存在: $([ -f "$BACKUP_FILE_NEW" ] && echo "是" || echo "否")"
    log_msg "DEBUG" "原文件存在: $([ -f "$TARGET_FILE_NEW" ] && echo "是" || echo "否")"
fi

# 检测元模块是否存在
detect_meta_modules() {
    local meta_detected=false
    local meta_list=""

    # 常见的元模块检测
    for meta_module in "overlayfs" "meta-overlayfs" "meta-hybrid" "meta_hybrid_mount"; do
        if [ -d "/data/adb/modules/$meta_module" ] && [ ! -f "/data/adb/modules/$meta_module/disable" ]; then
            meta_detected=true
            meta_list="$meta_list $meta_module"
        fi
    done

    if [ "$meta_detected" = true ]; then
        log_msg "META" "检测到元模块:$meta_list"
        log_msg "META" "将使用兼容模式进行挂载"
        return 0
    else
        log_msg "META" "未检测到元模块，使用标准挂载"
        return 1
    fi
}

##########################################################################################
# Magic Mount 处理函数 - 将文件复制到 system/ 目录
##########################################################################################

# Magic Mount 方式：复制文件到 system/ 目录，让 Magisk/元模块自动挂载
magic_mount_file() {
    local module_file="$1"
    local system_file="$2"
    local file_name="$3"

    if [ ! -f "$module_file" ]; then
        log_msg "MAGIC" "$file_name 模块文件不存在，跳过 Magic Mount"
        # 如果 system 目录中有旧文件，删除它
        if [ -f "$system_file" ]; then
            rm -f "$system_file" 2>/dev/null
            log_msg "MAGIC" "$file_name 清理 system 目录旧文件"
        fi
        return 1
    fi

    log_msg "MAGIC" "准备 Magic Mount: $file_name"
    log_msg "DEBUG" "源文件: $module_file"
    log_msg "DEBUG" "目标位置: $system_file"
    log_msg "DEBUG" "文件大小: $(wc -c < "$module_file" 2>/dev/null || echo "0") 字节"

    # 确保目标目录存在
    local target_dir=$(dirname "$system_file")
    if ! mkdir -p "$target_dir" 2>/dev/null; then
        log_msg "ERROR" "$file_name Magic Mount 目录创建失败: $target_dir"
        return 1
    fi

    # 复制文件到 system 目录
    if cp "$module_file" "$system_file" 2>/dev/null; then
        chmod 0644 "$system_file" 2>/dev/null

        # 验证复制成功
        if [ -f "$system_file" ]; then
            local copied_size=$(wc -c < "$system_file" 2>/dev/null || echo "0")
            local source_size=$(wc -c < "$module_file" 2>/dev/null || echo "0")

            if [ "$copied_size" -eq "$source_size" ] && [ "$copied_size" -gt 0 ]; then
                log_msg "SUCCESS" "$file_name Magic Mount 准备完成 ($copied_size 字节)"
                log_msg "INFO" "文件将由 Magisk/元模块自动挂载到系统"
                return 0
            else
                log_msg "ERROR" "$file_name 复制后大小不匹配 (源: $source_size, 复制: $copied_size)"
                return 1
            fi
        else
            log_msg "ERROR" "$file_name 复制后文件不存在"
            return 1
        fi
    else
        log_msg "ERROR" "$file_name Magic Mount 复制失败"
        return 1
    fi
}

##########################################################################################
# 手动挂载处理函数 - 直接 bind mount（KernelSU 无元模块环境）
##########################################################################################

# 等待目标文件系统准备就绪
wait_for_target() {
    local target_file="$1"
    local max_wait=10
    local wait_count=0

    log_msg "WAIT" "等待目标文件准备就绪: $target_file"

    while [ $wait_count -lt $max_wait ]; do
        if [ -e "$target_file" ] && [ -r "$target_file" ]; then
            log_msg "SUCCESS" "目标文件已准备就绪 (等待 ${wait_count}s)"
            return 0
        fi
        sleep 1
        wait_count=$((wait_count + 1))
    done

    log_msg "WARN" "目标文件等待超时，但继续尝试挂载"
    return 1
}

# 解除已有挂载（如果存在）
unmount_if_exists() {
    local target_file="$1"
    local file_name="$2"

    if mount | grep -q "$target_file"; then
        log_msg "INFO" "$file_name 检测到已有挂载，尝试解除"
        if umount "$target_file" 2>/dev/null; then
            log_msg "SUCCESS" "$file_name 已有挂载已解除"
            sleep 0.5
            return 0
        else
            log_msg "WARN" "$file_name 解除挂载失败，可能被占用"
            return 1
        fi
    fi
    return 0
}

# 挂载处理函数 - 元模块兼容版本
mount_file() {
    local module_file="$1"
    local target_file="$2"
    local file_name="$3"
    local max_retries=5
    local retry_count=0
    local use_meta_compat=false

    # 检测是否需要元模块兼容模式
    detect_meta_modules && use_meta_compat=true

    if [ ! -f "$module_file" ]; then
        log_msg "INFO" "$file_name 模块文件不存在，跳过挂载"
        return 1
    fi

    log_msg "INFO" "发现模块文件: $file_name"
    log_msg "DEBUG" "文件大小: $(wc -c < "$module_file" 2>/dev/null || echo "0") 字节"
    log_msg "DEBUG" "兼容模式: $use_meta_compat"

    # 设置权限
    if chmod 0644 "$module_file" 2>/dev/null; then
        log_msg "SUCCESS" "$file_name 权限设置成功"
    else
        log_msg "WARN" "$file_name 权限设置失败，但继续执行"
    fi

    # 等待目标文件系统准备（元模块模式下更重要）
    if [ "$use_meta_compat" = true ]; then
        wait_for_target "$target_file"
    fi

    # 检查目标文件是否存在
    if [ ! -e "$target_file" ]; then
        log_msg "WARN" "$file_name 目标文件不存在: $target_file"
        return 1
    fi

    # 解除已有挂载（避免冲突）
    unmount_if_exists "$target_file" "$file_name"

    # 带重试和延迟的绑定挂载
    while [ $retry_count -lt $max_retries ]; do
        # 元模块兼容模式：添加额外延迟
        if [ "$use_meta_compat" = true ] && [ $retry_count -gt 0 ]; then
            local delay=$((retry_count * 2))
            log_msg "META" "$file_name 元模块模式延迟 ${delay}s 后重试"
            sleep $delay
        fi

        # 尝试挂载
        if mount -o bind "$module_file" "$target_file" 2>/dev/null; then
            # 短暂延迟后验证
            sleep 0.5

            # 验证挂载是否成功
            if mount | grep -q "$target_file"; then
                # 二次验证：检查文件内容是否正确
                local mounted_size=$(stat -c%s "$target_file" 2>/dev/null || echo "0")
                local module_size=$(stat -c%s "$module_file" 2>/dev/null || echo "0")

                if [ "$mounted_size" -eq "$module_size" ] && [ "$mounted_size" -gt 0 ]; then
                    log_msg "SUCCESS" "$file_name 绑定挂载成功并验证"
                    log_msg "DEBUG" "挂载验证: $mounted_size 字节"
                    return 0
                else
                    log_msg "WARN" "$file_name 挂载成功但内容验证失败 (expected: $module_size, got: $mounted_size)"
                    umount "$target_file" 2>/dev/null
                fi
            else
                log_msg "WARN" "$file_name 挂载命令执行成功但验证失败"
            fi
        else
            log_msg "DEBUG" "$file_name 挂载命令执行失败"
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            log_msg "WARN" "$file_name 挂载失败，重试 $retry_count/$max_retries"
            sleep 1
        fi
    done

    log_msg "ERROR" "$file_name 绑定挂载最终失败"
    log_msg "ERROR" "可能的原因："
    log_msg "ERROR" "  1. 元模块冲突（请检查模块加载顺序）"
    log_msg "ERROR" "  2. SELinux 权限问题"
    log_msg "ERROR" "  3. 文件系统只读"
    log_msg "ERROR" "  4. 其他模块占用了挂载点"
    return 1
}

# 挂载 multimedia_display_feature_config.xml
log_msg "MAIN" "检查并挂载 multimedia_display_feature_config.xml"

if [ "$MOUNT_STRATEGY" = "magic_mount" ]; then
    # 使用 Magic Mount（Magisk 或 KernelSU + 元模块）
    if magic_mount_file "$MODULE_FILE" "$SYSTEM_MOUNT_FILE" "multimedia_display_feature_config.xml"; then
        feature_mounted="已准备 (Magic Mount)"
    else
        feature_mounted="未挂载"
    fi
else
    # 使用手动 bind mount（KernelSU 无元模块）
    if mount_file "$MODULE_FILE" "$TARGET_FILE" "multimedia_display_feature_config.xml"; then
        feature_mounted="已挂载 (Manual)"
    else
        feature_mounted="未挂载"
    fi
fi

# 挂载 multimedia_display_uir_config.xml
log_msg "MAIN" "检查并挂载 multimedia_display_uir_config.xml"

if [ "$MOUNT_STRATEGY" = "magic_mount" ]; then
    # 使用 Magic Mount（Magisk 或 KernelSU + 元模块）
    if magic_mount_file "$MODULE_FILE_NEW" "$SYSTEM_MOUNT_FILE_NEW" "multimedia_display_uir_config.xml"; then
        uir_mounted="已准备 (Magic Mount)"
    else
        uir_mounted="未挂载"
    fi
else
    # 使用手动 bind mount（KernelSU 无元模块）
    if mount_file "$MODULE_FILE_NEW" "$TARGET_FILE_NEW" "multimedia_display_uir_config.xml"; then
        uir_mounted="已挂载 (Manual)"
    else
        uir_mounted="未挂载"
    fi
fi

# 记录最终状态
log_msg "FINAL" "======== 最终执行状态 ========"
log_msg "FINAL" "挂载策略: $MOUNT_STRATEGY"
log_msg "FINAL" "功能配置文件: $feature_mounted"
log_msg "FINAL" "UIR 配置文件: $uir_mounted"

# 记录文件状态
if [ -f "$MODULE_FILE" ]; then
    feature_size=$(wc -c < "$MODULE_FILE" 2>/dev/null || echo "0")
    log_msg "FINAL" "功能配置文件大小: $feature_size 字节"
fi

if [ -f "$MODULE_FILE_NEW" ]; then
    uir_size=$(wc -c < "$MODULE_FILE_NEW" 2>/dev/null || echo "0")
    log_msg "FINAL" "UIR配置文件大小: $uir_size 字节"
fi

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

log_msg "INFO" "XML处理逻辑已移至WebUI，请通过WebUI界面进行文件合并操作"
log_msg "END" "======== post-fs-data.sh 执行结束 ========"

# 始终成功退出以避免启动失败
exit 0