#!/system/bin/sh

# 此脚本在文件系统挂载后运行
# 简化版本：只负责备份原始文件和挂载模块文件
# XML 处理由 WebUI 的 JavaScript 完成

MODPATH="$(dirname "$(realpath "$0")")" # 模块目录路径
BACKUP_DIR="$MODPATH/backup" # 备份目录

# 调试日志
log_file="$MODPATH/log.txt"

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

TARGET_FILE_NEW="/my_product/vendor/etc/multimedia_display_uir_config.xml"
BACKUP_FILE_NEW="$BACKUP_DIR/multimedia_display_uir_config.xml"
MODULE_FILE_NEW="$MODPATH/multimedia_display_uir_config.xml"

# 初始化日志文件
if [ -f "$log_file" ]; then
    rm "$log_file" 2>/dev/null || true
fi

# 开始记录新的执行日志
log_msg "START" "======== post-fs-data.sh 开始执行 (简化版本) ========"
log_msg "INFO" "模块路径: $MODPATH"
log_msg "INFO" "备份目录: $BACKUP_DIR"

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

# 挂载处理函数
mount_file() {
    local module_file="$1"
    local target_file="$2"
    local file_name="$3"
    
    if [ -f "$module_file" ]; then
        log_msg "INFO" "发现模块文件: $file_name"
        log_msg "DEBUG" "文件大小: $(wc -c < "$module_file" 2>/dev/null || echo "0") 字节"
        
        # 设置权限
        if chmod 0644 "$module_file" 2>/dev/null; then
            log_msg "SUCCESS" "$file_name 权限设置成功"
        else
            log_msg "WARN" "$file_name 权限设置失败，但继续执行"
        fi
        
        # 设置 SELinux 上下文（如果支持）
        local original_context=$(ls -Zd "$target_file" 2>/dev/null | awk '{print $1}')
        if [ -n "$original_context" ]; then
            if chcon "$original_context" "$module_file" 2>/dev/null; then
                log_msg "SUCCESS" "$file_name SELinux上下文设置成功"
            else
                log_msg "WARN" "$file_name SELinux上下文设置失败，但继续执行"
            fi
        fi
        
        # 执行绑定挂载
        if mount -o bind "$module_file" "$target_file" 2>/dev/null; then
            log_msg "SUCCESS" "$file_name 绑定挂载成功"
            return 0
        else
            log_msg "WARN" "$file_name 绑定挂载失败（目标路径可能不存在）"
            return 1
        fi
    else
        log_msg "INFO" "$file_name 模块文件不存在，跳过挂载"
        return 1
    fi
}

# 挂载 multimedia_display_feature_config.xml
log_msg "MAIN" "检查并挂载 multimedia_display_feature_config.xml"
if mount_file "$MODULE_FILE" "$TARGET_FILE" "multimedia_display_feature_config.xml"; then
    feature_mounted="已挂载"
else
    feature_mounted="未挂载"
fi

# 挂载 multimedia_display_uir_config.xml
log_msg "MAIN" "检查并挂载 multimedia_display_uir_config.xml"
if mount_file "$MODULE_FILE_NEW" "$TARGET_FILE_NEW" "multimedia_display_uir_config.xml"; then
    uir_mounted="已挂载"
else
    uir_mounted="未挂载"
fi

# 记录最终状态
log_msg "FINAL" "======== 最终执行状态 ========"
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

log_msg "INFO" "XML处理逻辑已移至WebUI，请通过WebUI界面进行文件合并操作"
log_msg "END" "======== post-fs-data.sh 执行结束 ========"

# 始终成功退出
exit 0