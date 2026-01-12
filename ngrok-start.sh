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
    echo "BACKEND_PID=$BACKEND_PID" > "$PID_FILE"
    cd "$SCRIPT_DIR"
    sleep 2
    
    # 检查后端是否启动成功
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        log_error "后端启动失败，查看日志: /tmp/mes-backend.log"
        exit 1
    fi
    log_info "后端已启动 (PID: $BACKEND_PID)"
    
    # 2. 启动前端
    log_info "启动前端服务..."
    npm run dev > /tmp/mes-frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "FRONTEND_PID=$FRONTEND_PID" >> "$PID_FILE"
    sleep 3
    
    # 检查前端是否启动成功
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        log_error "前端启动失败，查看日志: /tmp/mes-frontend.log"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    log_info "前端已启动 (PID: $FRONTEND_PID)"
    
    # 3. 启动 ngrok
    log_info "启动 ngrok 隧道..."
    ngrok http $FRONTEND_PORT --log=stdout > /tmp/mes-ngrok.log 2>&1 &
    NGROK_PID=$!
    echo "NGROK_PID=$NGROK_PID" >> "$PID_FILE"
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
    
    echo "NGROK_URL=$NGROK_URL" >> "$PID_FILE"
    
    # 5. 发送 webhook
    send_webhook "started" "$NGROK_URL"
    
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
