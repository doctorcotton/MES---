#!/bin/bash

# MES 配方管理系统 - ngrok 自动启动脚本
# 功能：启动前端、后端、ngrok，并自动发送 webhook 到飞书

set -e

# ======================== 配置 ========================
SERVICE_NAME="MES配方管理系统"
FRONTEND_PORT=5173
WEBHOOK_URL="https://k11pnjpvz1.feishu.cn/base/workflow/webhook/event/IGolaXSBbwNnxsh5FSOc9K82njh"
NGROK_API="http://127.0.0.1:4040/api/tunnels"
PID_FILE="/tmp/mes-ngrok.pid"

# ======================== 颜色 ========================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ======================== 脚本目录 ========================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ======================== 辅助函数 ========================
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 未安装"
        exit 1
    fi
}

# 打开日志终端窗口（macOS）
open_log_terminal() {
    local title=$1
    local log_file=$2
    
    if ! command -v osascript &> /dev/null; then
        log_warn "osascript 不可用，跳过打开日志窗口（非 macOS 系统）"
        return 0
    fi
    
    # 确保日志文件存在
    touch "$log_file"
    
    # 使用 osascript 打开新终端窗口并执行 tail -f
    # 使用 ANSI 转义序列设置窗口标题
    osascript -e "tell application \"Terminal\"" \
              -e "  do script \"printf '\\\\033]0;$title\\\\007'; tail -f '$log_file'\"" \
              -e "end tell" > /dev/null 2>&1 || log_warn "无法打开日志窗口: $title"
}

# 发送 webhook 到飞书
send_webhook() {
    local status=$1
    local url=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    local payload=$(cat <<EOF
{
    "service_name": "${SERVICE_NAME}",
    "service_url": "${url}",
    "host_ip": "ngrok",
    "port": ${FRONTEND_PORT},
    "start_time": "${timestamp}",
    "status": "${status}"
}
EOF
)
    
    log_info "发送 webhook: ${status}"
    curl -s -X POST "${WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "${payload}" > /dev/null 2>&1 || log_warn "Webhook 发送失败"
}

# 获取 ngrok 公网地址
get_ngrok_url() {
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local response=$(curl -s "${NGROK_API}" 2>/dev/null)
        local url=$(echo "$response" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$url" ]; then
            echo "$url"
            return 0
        fi
        
        sleep 1
        ((attempt++))
    done
    
    return 1
}

# 检查 ngrok 是否可用（返回 0 表示可用，1 表示不可用）
check_ngrok_available() {
    local response=$(curl -s "${NGROK_API}" 2>/dev/null)
    if [ -z "$response" ]; then
        return 1
    fi
    
    local url=$(echo "$response" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -z "$url" ]; then
        return 1
    fi
    
    return 0
}

# 重启 ngrok
restart_ngrok() {
    log_warn "检测到 ngrok 不可用，正在重启..."
    
    # 读取当前 PID 文件
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE"
    fi
    
    # 停止旧的 ngrok 进程（如果存在）
    if [ -n "$NGROK_PID" ] && kill -0 $NGROK_PID 2>/dev/null; then
        log_info "停止旧的 ngrok 进程 (PID: $NGROK_PID)..."
        kill $NGROK_PID 2>/dev/null || true
        sleep 2
    fi
    
    # 启动新的 ngrok
    log_info "启动新的 ngrok 隧道..."
    ngrok http $FRONTEND_PORT --log=stdout > /tmp/mes-ngrok.log 2>&1 &
    NGROK_PID=$!
    sleep 3
    
    # 检查是否启动成功
    if ! kill -0 $NGROK_PID 2>/dev/null; then
        log_error "ngrok 重启失败"
        return 1
    fi
    
    # 获取新地址
    local new_url=$(get_ngrok_url)
    if [ -z "$new_url" ]; then
        log_error "无法获取新的 ngrok 公网地址"
        return 1
    fi
    
    # 更新 PID 文件（重写整个文件）
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE"
    fi
    {
        echo "BACKEND_PID=${BACKEND_PID}"
        echo "FRONTEND_PID=${FRONTEND_PID}"
        echo "NGROK_PID=${NGROK_PID}"
        echo "NGROK_URL=${new_url}"
        echo "MONITOR_PID=${MONITOR_PID:-}"
    } > "$PID_FILE"
    
    log_info "ngrok 已重启，新地址: ${new_url}"
    return 0
}

# 更新 PID 文件（统一重写，确保一致性）
update_pid_file() {
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE"
    fi
    {
        echo "BACKEND_PID=${BACKEND_PID}"
        echo "FRONTEND_PID=${FRONTEND_PID}"
        echo "NGROK_PID=${NGROK_PID}"
        echo "NGROK_URL=${NGROK_URL}"
        echo "MONITOR_PID=${MONITOR_PID:-}"
    } > "$PID_FILE"
}

# 后台守护：监听 ngrok 地址变化并自动重启
monitor_ngrok() {
    local poll_interval=120  # 2 分钟
    local last_url=""
    
    # 读取初始 URL
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE"
        last_url="${NGROK_URL:-}"
    fi
    
    log_info "启动 ngrok 监听器 (轮询间隔: ${poll_interval}秒)"
    
    while true; do
        sleep $poll_interval
        
        # 检查 PID 文件是否还存在（如果不存在说明服务已停止）
        if [ ! -f "$PID_FILE" ]; then
            log_info "PID 文件不存在，监听器退出"
            exit 0
        fi
        
        # 读取当前 PID 文件
        source "$PID_FILE"
        
        # 检查 ngrok 是否可用
        if ! check_ngrok_available; then
            log_warn "检测到 ngrok 不可用"
            
            # 尝试重启 ngrok
            if restart_ngrok; then
                # 重新读取 PID 文件获取新 URL
                source "$PID_FILE"
                local new_url="${NGROK_URL:-}"
                
                # 如果地址变化了，发送 webhook
                if [ -n "$new_url" ] && [ "$new_url" != "$last_url" ]; then
                    log_info "ngrok 地址已更新: ${new_url}"
                    send_webhook "started" "$new_url"
                    last_url="$new_url"
                fi
            else
                log_warn "ngrok 重启失败，将在下次轮询时重试"
            fi
        else
            # ngrok 可用，检查地址是否变化
            local current_url=$(get_ngrok_url)
            
            if [ -n "$current_url" ] && [ "$current_url" != "$last_url" ]; then
                log_info "检测到 ngrok 地址变化: ${last_url} -> ${current_url}"
                
                # 更新 PID 文件
                if [ -f "$PID_FILE" ]; then
                    source "$PID_FILE"
                fi
                NGROK_URL="$current_url"
                update_pid_file
                
                # 发送 webhook
                send_webhook "started" "$current_url"
                last_url="$current_url"
            fi
        fi
    done
}

# ======================== 主函数 ========================
main() {
    log_info "========== MES 配方管理系统启动 =========="
    
    # 检查依赖
    check_command "node"
    check_command "npm"
    check_command "ngrok"
    check_command "curl"
    
    # 清理所有旧的 ngrok 进程（避免获取到错误的地址）
    log_info "清理旧的 ngrok 进程..."
    pkill -f "ngrok" 2>/dev/null || true
    sleep 1
    
    # 检查是否已经在运行
    if [ -f "$PID_FILE" ]; then
        log_warn "服务可能已在运行，先停止旧服务..."
        "$SCRIPT_DIR/ngrok-stop.sh" 2>/dev/null || true
        sleep 2
    fi
    
    # 1. 启动后端
    log_info "启动后端服务..."
    cd "$SCRIPT_DIR/server"
    npm run dev > /tmp/mes-backend.log 2>&1 &
    BACKEND_PID=$!
    cd "$SCRIPT_DIR"
    sleep 2
    
    # 检查后端是否启动成功
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        log_error "后端启动失败，查看日志: /tmp/mes-backend.log"
        exit 1
    fi
    log_info "后端已启动 (PID: $BACKEND_PID)"
    
    # 打开后端日志窗口
    open_log_terminal "MES 后端日志" "/tmp/mes-backend.log"
    
    # 2. 启动前端
    log_info "启动前端服务..."
    npm run dev > /tmp/mes-frontend.log 2>&1 &
    FRONTEND_PID=$!
    sleep 3
    
    # 检查前端是否启动成功
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        log_error "前端启动失败，查看日志: /tmp/mes-frontend.log"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    log_info "前端已启动 (PID: $FRONTEND_PID)"
    
    # 打开前端日志窗口
    open_log_terminal "MES 前端日志" "/tmp/mes-frontend.log"
    
    # 3. 启动 ngrok
    log_info "启动 ngrok 隧道..."
    ngrok http $FRONTEND_PORT --log=stdout > /tmp/mes-ngrok.log 2>&1 &
    NGROK_PID=$!
    sleep 3
    
    # 检查 ngrok 是否启动成功
    if ! kill -0 $NGROK_PID 2>/dev/null; then
        log_error "ngrok 启动失败，查看日志: /tmp/mes-ngrok.log"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    log_info "ngrok 已启动 (PID: $NGROK_PID)"
    
    # 4. 获取 ngrok 公网地址
    log_info "获取 ngrok 公网地址..."
    NGROK_URL=$(get_ngrok_url)
    
    if [ -z "$NGROK_URL" ]; then
        log_error "无法获取 ngrok 公网地址"
        "$SCRIPT_DIR/ngrok-stop.sh"
        exit 1
    fi
    
    # 5. 初始化 PID 文件（统一写入所有字段）
    MONITOR_PID=""
    update_pid_file
    
    # 6. 发送 webhook
    send_webhook "started" "$NGROK_URL"
    
    # 7. 启动后台监听器
    log_info "启动 ngrok 地址监听器..."
    # 使用 bash -c 启动监听器，传递所有必要的函数和变量
    bash -c "
        # 配置变量
        SERVICE_NAME='${SERVICE_NAME}'
        FRONTEND_PORT=${FRONTEND_PORT}
        WEBHOOK_URL='${WEBHOOK_URL}'
        NGROK_API='${NGROK_API}'
        PID_FILE='${PID_FILE}'
        SCRIPT_DIR='${SCRIPT_DIR}'
        
        # 颜色定义
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        NC='\033[0m'
        
        # 日志函数
        log_info() { echo -e \"\${GREEN}[INFO]\${NC} \$1\"; }
        log_warn() { echo -e \"\${YELLOW}[WARN]\${NC} \$1\"; }
        log_error() { echo -e \"\${RED}[ERROR]\${NC} \$1\"; }
        
        # 发送 webhook
        send_webhook() {
            local status=\$1
            local url=\$2
            local timestamp=\$(date \"+%Y-%m-%d %H:%M:%S\")
            local payload=\"{\\\"service_name\\\":\\\"\${SERVICE_NAME}\\\",\\\"service_url\\\":\\\"\${url}\\\",\\\"host_ip\\\":\\\"ngrok\\\",\\\"port\\\":\${FRONTEND_PORT},\\\"start_time\\\":\\\"\${timestamp}\\\",\\\"status\\\":\\\"\${status}\\\"}\"
            log_info \"发送 webhook: \${status}\"
            curl -s -X POST \"\${WEBHOOK_URL}\" -H \"Content-Type: application/json\" -d \"\${payload}\" > /dev/null 2>&1 || log_warn \"Webhook 发送失败\"
        }
        
        # 获取 ngrok 地址
        get_ngrok_url() {
            local max_attempts=30
            local attempt=0
            while [ \$attempt -lt \$max_attempts ]; do
                local response=\$(curl -s \"\${NGROK_API}\" 2>/dev/null)
                local url=\$(echo \"\$response\" | grep -o '\"public_url\":\"https://[^\"]*\"' | head -1 | cut -d'\"' -f4)
                if [ -n \"\$url\" ]; then
                    echo \"\$url\"
                    return 0
                fi
                sleep 1
                ((attempt++))
            done
            return 1
        }
        
        # 检查 ngrok 是否可用
        check_ngrok_available() {
            local response=\$(curl -s \"\${NGROK_API}\" 2>/dev/null)
            if [ -z \"\$response\" ]; then
                return 1
            fi
            local url=\$(echo \"\$response\" | grep -o '\"public_url\":\"https://[^\"]*\"' | head -1 | cut -d'\"' -f4)
            if [ -z \"\$url\" ]; then
                return 1
            fi
            return 0
        }
        
        # 重启 ngrok
        restart_ngrok() {
            log_warn \"检测到 ngrok 不可用，正在重启...\"
            if [ -f \"\$PID_FILE\" ]; then
                source \"\$PID_FILE\"
            fi
            if [ -n \"\$NGROK_PID\" ] && kill -0 \$NGROK_PID 2>/dev/null; then
                log_info \"停止旧的 ngrok 进程 (PID: \$NGROK_PID)...\"
                kill \$NGROK_PID 2>/dev/null || true
                sleep 2
            fi
            log_info \"启动新的 ngrok 隧道...\"
            ngrok http \$FRONTEND_PORT --log=stdout > /tmp/mes-ngrok.log 2>&1 &
            local new_pid=\$!
            sleep 3
            if ! kill -0 \$new_pid 2>/dev/null; then
                log_error \"ngrok 重启失败\"
                return 1
            fi
            local new_url=\$(get_ngrok_url)
            if [ -z \"\$new_url\" ]; then
                log_error \"无法获取新的 ngrok 公网地址\"
                return 1
            fi
            if [ -f \"\$PID_FILE\" ]; then
                source \"\$PID_FILE\"
            fi
            {
                echo \"BACKEND_PID=\${BACKEND_PID}\"
                echo \"FRONTEND_PID=\${FRONTEND_PID}\"
                echo \"NGROK_PID=\${new_pid}\"
                echo \"NGROK_URL=\${new_url}\"
                echo \"MONITOR_PID=\${MONITOR_PID:-}\"
            } > \"\$PID_FILE\"
            log_info \"ngrok 已重启，新地址: \${new_url}\"
            return 0
        }
        
        # 更新 PID 文件
        update_pid_file() {
            if [ -f \"\$PID_FILE\" ]; then
                source \"\$PID_FILE\"
            fi
            {
                echo \"BACKEND_PID=\${BACKEND_PID}\"
                echo \"FRONTEND_PID=\${FRONTEND_PID}\"
                echo \"NGROK_PID=\${NGROK_PID}\"
                echo \"NGROK_URL=\${NGROK_URL}\"
                echo \"MONITOR_PID=\${MONITOR_PID:-}\"
            } > \"\$PID_FILE\"
        }
        
        # 监听器主循环
        poll_interval=120
        last_url=\"\"
        if [ -f \"\$PID_FILE\" ]; then
            source \"\$PID_FILE\"
            last_url=\"\${NGROK_URL:-}\"
        fi
        log_info \"启动 ngrok 监听器 (轮询间隔: \${poll_interval}秒)\"
        while true; do
            sleep \$poll_interval
            if [ ! -f \"\$PID_FILE\" ]; then
                log_info \"PID 文件不存在，监听器退出\"
                exit 0
            fi
            source \"\$PID_FILE\"
            if ! check_ngrok_available; then
                log_warn \"检测到 ngrok 不可用\"
                if restart_ngrok; then
                    source \"\$PID_FILE\"
                    local new_url=\"\${NGROK_URL:-}\"
                    if [ -n \"\$new_url\" ] && [ \"\$new_url\" != \"\$last_url\" ]; then
                        log_info \"ngrok 地址已更新: \${new_url}\"
                        send_webhook \"started\" \"\$new_url\"
                        last_url=\"\$new_url\"
                    fi
                else
                    log_warn \"ngrok 重启失败，将在下次轮询时重试\"
                fi
            else
                local current_url=\$(get_ngrok_url)
                if [ -n \"\$current_url\" ] && [ \"\$current_url\" != \"\$last_url\" ]; then
                    log_info \"检测到 ngrok 地址变化: \${last_url} -> \${current_url}\"
                    if [ -f \"\$PID_FILE\" ]; then
                        source \"\$PID_FILE\"
                    fi
                    NGROK_URL=\"\$current_url\"
                    update_pid_file
                    send_webhook \"started\" \"\$current_url\"
                    last_url=\"\$current_url\"
                fi
            fi
        done
    " > /tmp/mes-monitor.log 2>&1 &
    MONITOR_PID=$!
    
    # 更新 PID 文件，包含监听器 PID
    update_pid_file
    
    if ! kill -0 $MONITOR_PID 2>/dev/null; then
        log_warn "监听器启动失败，但服务已启动"
    else
        log_info "监听器已启动 (PID: $MONITOR_PID)"
    fi
    
    # 6. 显示结果
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  MES 配方管理系统已启动！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  ${BLUE}公网访问地址:${NC} ${NGROK_URL}"
    echo -e "  ${BLUE}本地前端:${NC}     http://localhost:${FRONTEND_PORT}"
    echo -e "  ${BLUE}本地后端:${NC}     http://localhost:3001"
    echo -e "  ${BLUE}ngrok 管理:${NC}   http://127.0.0.1:4040"
    echo ""
    echo -e "  ${YELLOW}提示:${NC} 飞书已收到 webhook 通知"
    echo -e "  ${YELLOW}停止:${NC} ./ngrok-stop.sh"
    echo ""
    
    log_info "所有服务已启动完成！"
}

main
