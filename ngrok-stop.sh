#!/bin/bash

# MES 配方管理系统 - ngrok 停止脚本
# 功能：停止所有服务并发送 webhook 通知

# ======================== 配置 ========================
SERVICE_NAME="MES配方管理系统"
WEBHOOK_URL="https://k11pnjpvz1.feishu.cn/base/workflow/webhook/event/IGolaXSBbwNnxsh5FSOc9K82njh"
PID_FILE="/tmp/mes-ngrok.pid"

# ======================== 颜色 ========================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ======================== 辅助函数 ========================
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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
    "port": 5173,
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

# ======================== 主函数 ========================
main() {
    log_info "========== MES 配方管理系统停止 =========="
    
    local ngrok_url=""
    
    # 读取 PID 文件
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE"
        
        # 获取 ngrok URL 用于 webhook
        ngrok_url="${NGROK_URL:-stopped}"
        
        # 优先停止监听器（防止它在停止过程中重启 ngrok）
        if [ -n "$MONITOR_PID" ] && kill -0 $MONITOR_PID 2>/dev/null; then
            log_info "停止监听器 (PID: $MONITOR_PID)..."
            kill $MONITOR_PID 2>/dev/null || true
            sleep 1
        fi
        
        # 停止 ngrok
        if [ -n "$NGROK_PID" ] && kill -0 $NGROK_PID 2>/dev/null; then
            log_info "停止 ngrok (PID: $NGROK_PID)..."
            kill $NGROK_PID 2>/dev/null || true
        fi
        
        # 停止前端
        if [ -n "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
            log_info "停止前端 (PID: $FRONTEND_PID)..."
            kill $FRONTEND_PID 2>/dev/null || true
        fi
        
        # 停止后端
        if [ -n "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
            log_info "停止后端 (PID: $BACKEND_PID)..."
            kill $BACKEND_PID 2>/dev/null || true
        fi
        
        # 删除 PID 文件
        rm -f "$PID_FILE"
    else
        log_warn "PID 文件不存在，尝试通过进程名停止..."
    fi
    
    # 额外清理：通过进程名查找并停止
    # 停止监听器（通过进程名查找 monitor_ngrok 函数）
    pkill -f "monitor_ngrok" 2>/dev/null || true
    
    # 停止 ngrok
    pkill -f "ngrok http" 2>/dev/null || true
    
    # 停止 vite (前端)
    pkill -f "vite" 2>/dev/null || true
    
    # 停止 tsx watch (后端)
    pkill -f "tsx watch src/index.ts" 2>/dev/null || true
    
    # 发送停止 webhook
    send_webhook "stopped" "$ngrok_url"
    
    # 清理日志文件
    rm -f /tmp/mes-backend.log /tmp/mes-frontend.log /tmp/mes-ngrok.log 2>/dev/null
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  MES 配方管理系统已停止${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  ${YELLOW}提示:${NC} 飞书已收到停止通知"
    echo -e "  ${YELLOW}启动:${NC} ./ngrok-start.sh"
    echo ""
    
    log_info "所有服务已停止！"
}

main
