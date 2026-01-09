#!/bin/bash

# MES 项目 Nginx 反向代理启动脚本
# 使用 Docker Compose 管理 nginx 服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查函数
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker 未安装${NC}"
        echo "请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
}

check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}错误: Docker Compose 未安装${NC}"
        echo "请先安装 Docker Compose"
        exit 1
    fi
}

check_config() {
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${RED}错误: docker-compose.yml 文件不存在${NC}"
        exit 1
    fi
    
    if [ ! -f "nginx/nginx.conf" ]; then
        echo -e "${RED}错误: nginx/nginx.conf 文件不存在${NC}"
        exit 1
    fi
}

# 创建日志目录
create_log_dir() {
    if [ ! -d "nginx/logs" ]; then
        mkdir -p nginx/logs
        echo -e "${GREEN}创建日志目录: nginx/logs${NC}"
    fi
}

# 显示服务状态
show_status() {
    echo -e "\n${GREEN}=== 服务状态 ===${NC}"
    docker-compose ps 2>/dev/null || docker compose ps
    
    echo -e "\n${GREEN}=== 访问地址 ===${NC}"
    echo "前端访问: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP'):80"
    echo ""
    echo -e "${YELLOW}注意: 请确保开发服务器正在运行${NC}"
    echo "  - 前端: http://localhost:5173"
    echo "  - 后端: http://localhost:3001"
}

# 启动服务
start() {
    echo -e "${GREEN}启动 Nginx 反向代理服务...${NC}"
    
    check_docker
    check_docker_compose
    check_config
    create_log_dir
    
    echo -e "${YELLOW}检查开发服务器连接...${NC}"
    
    # 检查后端服务
    if ! curl -s http://localhost:3001/api/recipe/lock-status > /dev/null 2>&1; then
        echo -e "${YELLOW}警告: 无法连接到后端服务 (localhost:3001)${NC}"
        echo "请确保后端服务正在运行"
    fi
    
    # 检查前端服务
    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${YELLOW}警告: 无法连接到前端服务 (localhost:5173)${NC}"
        echo "请确保前端服务正在运行"
    fi
    
    # 启动 Docker Compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 服务启动成功${NC}"
        sleep 2
        show_status
    else
        echo -e "${RED}✗ 服务启动失败${NC}"
        exit 1
    fi
}

# 停止服务
stop() {
    echo -e "${YELLOW}停止服务...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose down
    else
        docker compose down
    fi
    echo -e "${GREEN}✓ 服务已停止${NC}"
}

# 重启服务
restart() {
    echo -e "${YELLOW}重启服务...${NC}"
    stop
    sleep 1
    start
}

# 查看日志
logs() {
    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f
    else
        docker compose logs -f
    fi
}

# 查看状态
status() {
    show_status
}

# 主函数
case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|logs|status}"
        echo ""
        echo "命令说明:"
        echo "  start   - 启动 nginx 反向代理服务"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  logs    - 查看日志（实时）"
        echo "  status  - 查看服务状态"
        exit 1
        ;;
esac

