#!/system/bin/sh

# ==== HDR WebUI Logger Manager ====
# 用于管理日志服务守护进程的脚本

MODULE_DIR="/data/adb/modules/enable-hdr-oneplus13-webui"
WEBROOT_DIR="${MODULE_DIR}/webroot"
DAEMON_SCRIPT="${WEBROOT_DIR}/scripts/logger-daemon.js"
PID_FILE="${MODULE_DIR}/logger-daemon.pid"
LOG_FILE="${MODULE_DIR}/webui.log"
DAEMON_LOG_FILE="${MODULE_DIR}/logger-daemon.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 输出函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查Node.js是否可用
check_nodejs() {
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js not found. Installing..."

        # 尝试安装Node.js (适用于Android环境)
        if command -v pkg >/dev/null 2>&1; then
            pkg install nodejs
        elif command -v apt >/dev/null 2>&1; then
            apt update && apt install -y nodejs
        elif command -v yum >/dev/null 2>&1; then
            yum install -y nodejs
        else
            log_error "Cannot install Node.js automatically. Please install manually."
            return 1
        fi
    fi

    local node_version=$(node --version 2>/dev/null)
    log_info "Node.js version: ${node_version}"
    return 0
}

# 检查守护进程是否运行
is_daemon_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            # PID文件存在但进程不存在，删除过期的PID文件
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# 启动守护进程
start_daemon() {
    log_info "Starting logger daemon..."

    if is_daemon_running; then
        local pid=$(cat "$PID_FILE")
        log_warn "Logger daemon is already running with PID $pid"
        return 0
    fi

    if ! check_nodejs; then
        log_error "Node.js is required to run the logger daemon"
        return 1
    fi

    if [ ! -f "$DAEMON_SCRIPT" ]; then
        log_error "Logger daemon script not found: $DAEMON_SCRIPT"
        return 1
    fi

    # 确保目录存在
    mkdir -p "$MODULE_DIR"

    # 启动守护进程
    cd "$WEBROOT_DIR"
    nohup node "$DAEMON_SCRIPT" >> "$DAEMON_LOG_FILE" 2>&1 &

    # 等待一下确保启动成功
    sleep 2

    if is_daemon_running; then
        local pid=$(cat "$PID_FILE")
        log_info "Logger daemon started successfully with PID $pid"
        return 0
    else
        log_error "Failed to start logger daemon"
        if [ -f "$DAEMON_LOG_FILE" ]; then
            log_error "Check daemon log file for details: $DAEMON_LOG_FILE"
            tail -10 "$DAEMON_LOG_FILE"
        fi
        return 1
    fi
}

# 停止守护进程
stop_daemon() {
    log_info "Stopping logger daemon..."

    if ! is_daemon_running; then
        log_warn "Logger daemon is not running"
        return 0
    fi

    local pid=$(cat "$PID_FILE")
    log_info "Sending SIGTERM to PID $pid..."

    if kill -TERM "$pid" 2>/dev/null; then
        # 等待优雅关闭
        local count=0
        while [ $count -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done

        if kill -0 "$pid" 2>/dev/null; then
            log_warn "Process did not stop gracefully, forcing..."
            kill -KILL "$pid" 2>/dev/null
        fi

        rm -f "$PID_FILE"
        log_info "Logger daemon stopped"
    else
        log_error "Failed to stop logger daemon"
        return 1
    fi
}

# 重启守护进程
restart_daemon() {
    log_info "Restarting logger daemon..."
    stop_daemon
    sleep 1
    start_daemon
}

# 获取守护进程状态
status_daemon() {
    if is_daemon_running; then
        local pid=$(cat "$PID_FILE")
        log_info "Logger daemon is running with PID $pid"

        # 显示内存使用情况
        if [ -f "/proc/$pid/status" ]; then
            local mem_kb=$(grep VmRSS /proc/$pid/status | awk '{print $2}')
            local mem_mb=$((mem_kb / 1024))
            log_info "Memory usage: ${mem_mb}MB"
        fi

        # 显示启动时间
        if [ -f "/proc/$pid/stat" ]; then
            local start_time=$(awk '{print $22}' /proc/$pid/stat)
            log_info "Start time: $start_time"
        fi

        return 0
    else
        log_warn "Logger daemon is not running"
        return 1
    fi
}

# 查看日志
view_logs() {
    local lines=${2:-50}

    case "$1" in
        "daemon")
            if [ -f "$DAEMON_LOG_FILE" ]; then
                log_info "Last $lines lines of daemon log:"
                tail -n "$lines" "$DAEMON_LOG_FILE"
            else
                log_warn "Daemon log file not found: $DAEMON_LOG_FILE"
            fi
            ;;
        "main"|"webui")
            if [ -f "$LOG_FILE" ]; then
                log_info "Last $lines lines of webui log:"
                tail -n "$lines" "$LOG_FILE"
            else
                log_warn "WebUI log file not found: $LOG_FILE"
            fi
            ;;
        *)
            log_error "Unknown log type. Use: daemon or main/webui"
            return 1
            ;;
    esac
}

# 轮转日志
rotate_logs() {
    log_info "Triggering log rotation..."

    if is_daemon_running; then
        local pid=$(cat "$PID_FILE")
        kill -USR2 "$pid" 2>/dev/null
        log_info "Log rotation signal sent to daemon"
    else
        log_error "Logger daemon is not running"
        return 1
    fi
}

# 显示统计信息
show_stats() {
    log_info "Requesting daemon statistics..."

    if is_daemon_running; then
        local pid=$(cat "$PID_FILE")
        kill -USR1 "$pid" 2>/dev/null
        log_info "Statistics signal sent to daemon. Check daemon log for details."
        sleep 1
        view_logs daemon 20
    else
        log_error "Logger daemon is not running"
        return 1
    fi
}

# 清理日志文件
cleanup_logs() {
    log_info "Cleaning up old log files..."

    # 清理7天前的轮转日志文件
    find "$MODULE_DIR" -name "webui.log.*" -type f -mtime +7 -delete 2>/dev/null
    find "$MODULE_DIR" -name "logger-daemon.log.*" -type f -mtime +7 -delete 2>/dev/null

    # 显示当前日志文件大小
    log_info "Current log file sizes:"
    if [ -f "$LOG_FILE" ]; then
        ls -lh "$LOG_FILE" | awk '{print "webui.log: " $5}'
    fi
    if [ -f "$DAEMON_LOG_FILE" ]; then
        ls -lh "$DAEMON_LOG_FILE" | awk '{print "daemon.log: " $5}'
    fi
}

# 安装为系统服务
install_service() {
    log_info "Installing logger daemon as system service..."

    # 创建服务脚本
    local service_script="/system/bin/hdr-logger"

    cat > "$service_script" << 'EOF'
#!/system/bin/sh
# HDR WebUI Logger Service

MODULE_DIR="/data/adb/modules/enable-hdr-oneplus13-webui"
MANAGER_SCRIPT="${MODULE_DIR}/webroot/scripts/logger-manager.sh"

case "$1" in
    start)
        "$MANAGER_SCRIPT" start
        ;;
    stop)
        "$MANAGER_SCRIPT" stop
        ;;
    restart)
        "$MANAGER_SCRIPT" restart
        ;;
    status)
        "$MANAGER_SCRIPT" status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
EOF

    chmod +x "$service_script"
    log_info "Service script installed: $service_script"

    # 添加到启动脚本
    local boot_script="${MODULE_DIR}/service.sh"
    if [ -f "$boot_script" ]; then
        if ! grep -q "hdr-logger start" "$boot_script"; then
            echo "" >> "$boot_script"
            echo "# Start logger daemon" >> "$boot_script"
            echo "/system/bin/hdr-logger start &" >> "$boot_script"
            log_info "Added logger daemon to boot script"
        fi
    fi

    log_info "Logger daemon service installation complete"
}

# 卸载系统服务
uninstall_service() {
    log_info "Uninstalling logger daemon service..."

    # 停止守护进程
    stop_daemon

    # 删除服务脚本
    rm -f "/system/bin/hdr-logger"

    # 从启动脚本中移除
    local boot_script="${MODULE_DIR}/service.sh"
    if [ -f "$boot_script" ]; then
        sed -i '/hdr-logger start/d' "$boot_script"
        sed -i '/Start logger daemon/d' "$boot_script"
    fi

    log_info "Logger daemon service uninstalled"
}

# 显示帮助信息
show_help() {
    echo "HDR WebUI Logger Manager"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start                 Start the logger daemon"
    echo "  stop                  Stop the logger daemon"
    echo "  restart               Restart the logger daemon"
    echo "  status                Show daemon status"
    echo "  logs <type> [lines]   View logs (daemon/webui)"
    echo "  cleanup               Clean up old log files"
    echo "  help                  Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs daemon 100"
    echo "  $0 logs webui"
    echo ""
}

# 主函数
main() {
    case "${1:-help}" in
        "start")
            start_daemon
            ;;
        "stop")
            stop_daemon
            ;;
        "restart")
            restart_daemon
            ;;
        "status")
            status_daemon
            ;;
        "logs")
            view_logs "$2" "$3"
            ;;
        "cleanup")
            cleanup_logs
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"