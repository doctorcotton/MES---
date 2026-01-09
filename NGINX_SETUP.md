# Nginx 反向代理部署指南

本指南介绍如何在云服务器上使用 Docker Compose 部署 nginx 反向代理，将本地开发服务器暴露到外网，并限制只有公司 IP 段可以访问。

## 架构说明

```
互联网 → 云服务器 nginx (80端口) → 本地开发服务器
         ├─ 前端代理 (/) → localhost:5173
         ├─ API 代理 (/api) → localhost:3001
         └─ WebSocket 代理 (/socket.io) → localhost:3001
```

## 前置条件

1. **云服务器**：已安装 Docker 和 Docker Compose
2. **开发服务器**：前端和后端服务在本地运行
   - 前端：`http://localhost:5173`
   - 后端：`http://localhost:3001`
3. **网络连接**：云服务器能够访问到开发服务器（同机、SSH 隧道或 VPN）

## 快速开始

### 1. 上传文件到云服务器

将以下文件上传到云服务器：

```
项目根目录/
├── docker-compose.yml
├── start.sh
└── nginx/
    └── nginx.conf
```

### 2. 设置执行权限

```bash
chmod +x start.sh
```

### 3. 启动服务

```bash
./start.sh start
```

### 4. 验证服务

访问 `http://YOUR_SERVER_IP` 即可访问前端应用。

## 详细步骤

### 步骤 1: 准备云服务器环境

#### 1.1 检查 Docker 和 Docker Compose

```bash
# 检查 Docker
docker --version

# 检查 Docker Compose
docker-compose --version
# 或
docker compose version
```

如果未安装，请参考：
- Docker: https://docs.docker.com/get-docker/
- Docker Compose: https://docs.docker.com/compose/install/

#### 1.2 创建项目目录

```bash
mkdir -p /opt/mes-nginx
cd /opt/mes-nginx
```

### 步骤 2: 上传配置文件

将以下文件上传到云服务器：

- `docker-compose.yml` - Docker Compose 配置
- `start.sh` - 启动脚本
- `nginx/nginx.conf` - Nginx 配置文件

可以使用 `scp` 命令：

```bash
# 从本地上传到云服务器
scp docker-compose.yml start.sh user@your-server:/opt/mes-nginx/
scp -r nginx user@your-server:/opt/mes-nginx/
```

### 步骤 3: 配置网络

#### 3.1 云服务器安全组设置

在云服务器控制台配置安全组，开放以下端口：
- **80 端口**（HTTP）- 允许公司 IP 段访问

#### 3.2 防火墙配置

**Ubuntu/Debian:**

```bash
# 使用 ufw
sudo ufw allow 80/tcp
sudo ufw reload

# 或使用 iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables-save
```

**CentOS/RHEL:**

```bash
# 使用 firewalld
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload

# 或使用 iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo service iptables save
```

### 步骤 4: 配置开发服务器连接

#### 方案 A: 开发服务器在同一台云服务器上

如果前端和后端服务也在云服务器上运行，nginx 配置已经使用 `host.docker.internal`。

**注意**：`docker-compose.yml` 中已配置 `extra_hosts`，将 `host.docker.internal` 映射到宿主机，可以直接连接。

#### 方案 B: 开发服务器在本地（通过 SSH 隧道）

如果开发服务器在本地，需要通过 SSH 隧道将本地端口映射到云服务器：

```bash
# 在本地执行，将本地端口映射到云服务器
ssh -R 5173:localhost:5173 -R 3001:localhost:3001 user@your-server

# 或者使用 autossh 保持连接
autossh -M 20000 -R 5173:localhost:5173 -R 3001:localhost:3001 user@your-server
```

然后修改 `nginx/nginx.conf`，将 `host.docker.internal` 改为 `localhost`：

```nginx
proxy_pass http://localhost:5173;
proxy_pass http://localhost:3001;
```

#### 方案 C: 开发服务器在内网（通过 VPN）

如果开发服务器在内网，通过 VPN 连接后，修改 `nginx/nginx.conf` 中的代理地址为内网 IP：

```nginx
proxy_pass http://内网IP:5173;
proxy_pass http://内网IP:3001;
```

### 步骤 5: 启动服务

#### 5.1 检查配置文件

```bash
# 检查文件是否存在
ls -la docker-compose.yml
ls -la start.sh
ls -la nginx/nginx.conf
```

#### 5.2 设置执行权限

```bash
chmod +x start.sh
```

#### 5.3 启动服务

```bash
./start.sh start
```

启动脚本会自动：
- 检查 Docker 和 Docker Compose
- 检查配置文件
- 创建日志目录
- 检查开发服务器连接
- 启动 nginx 容器

### 步骤 6: 验证部署

#### 6.1 检查服务状态

```bash
./start.sh status
```

或直接使用 Docker Compose：

```bash
docker-compose ps
```

#### 6.2 测试 IP 白名单

**从公司 IP 访问（应该成功）：**

```bash
curl http://YOUR_SERVER_IP
```

**从非公司 IP 访问（应该返回 403）：**

```bash
# 从其他 IP 访问应该被拒绝
curl http://YOUR_SERVER_IP
# 返回: 403 Forbidden
```

#### 6.3 测试前端访问

在浏览器中访问：`http://YOUR_SERVER_IP`

#### 6.4 测试 API 代理

```bash
curl http://YOUR_SERVER_IP/api/recipe/lock-status
```

#### 6.5 测试 WebSocket 连接

打开浏览器开发者工具，查看 Console，应该看到 "Socket连接成功"。

## 常用命令

### 启动服务

```bash
./start.sh start
```

### 停止服务

```bash
./start.sh stop
```

### 重启服务

```bash
./start.sh restart
```

### 查看日志

```bash
# 实时查看日志
./start.sh logs

# 或直接使用 docker-compose
docker-compose logs -f
```

### 查看服务状态

```bash
./start.sh status
```

### 查看容器日志

```bash
docker-compose logs mes-nginx
```

### 进入容器

```bash
docker-compose exec mes-nginx sh
```

## 配置文件说明

### docker-compose.yml

- **服务名**: `mes-nginx`（不使用 `server`）
- **端口映射**: `80:80`
- **配置文件挂载**: `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`
- **日志目录**: `./nginx/logs:/var/log/nginx`

### nginx/nginx.conf

主要配置：

1. **IP 白名单**: 限制只有公司 IP 段可以访问
   - 219.142.38.130-158
   - 114.251.106.210-223

2. **前端代理**: `/` → `http://host.docker.internal:5173`

3. **API 代理**: `/api/` → `http://host.docker.internal:3001`

4. **WebSocket 代理**: `/socket.io/` → `http://host.docker.internal:3001`

## 故障排查

### 问题 1: 服务启动失败

**检查 Docker 是否运行：**

```bash
docker ps
```

**查看错误日志：**

```bash
docker-compose logs
```

**检查配置文件语法：**

```bash
docker-compose exec mes-nginx nginx -t
```

### 问题 2: 无法访问前端

**检查开发服务器是否运行：**

```bash
# 在云服务器上测试
curl http://localhost:5173
curl http://localhost:3001/api/recipe/lock-status
```

**检查 nginx 日志：**

```bash
tail -f nginx/logs/error.log
tail -f nginx/logs/access.log
```

**检查容器状态：**

```bash
docker-compose ps
docker-compose logs mes-nginx
```

### 问题 3: WebSocket 连接失败

**检查 WebSocket 代理配置：**

确保 nginx 配置中包含正确的 WebSocket 升级头：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**检查浏览器控制台：**

查看是否有 WebSocket 连接错误。

### 问题 4: IP 白名单不生效

**检查 IP 地址：**

查看访问日志，确认客户端 IP：

```bash
tail -f nginx/logs/access.log
```

**验证 IP 是否在白名单中：**

检查 `nginx/nginx.conf` 中的 `geo $allowed_ip` 配置。

### 问题 5: 403 Forbidden

**可能原因：**

1. IP 不在白名单中
2. nginx 配置错误

**解决方法：**

1. 检查访问日志确认客户端 IP
2. 将 IP 添加到白名单
3. 重启服务：`./start.sh restart`

### 问题 6: 连接超时

**可能原因：**

1. 开发服务器未运行
2. 网络连接问题
3. 防火墙阻止

**解决方法：**

1. 确认开发服务器正在运行
2. 测试网络连接：`curl http://localhost:5173`
3. 检查防火墙规则

## 更新 IP 白名单

如果需要添加或修改 IP 白名单：

1. 编辑 `nginx/nginx.conf`
2. 在 `geo $allowed_ip` 块中添加 IP
3. 重启服务：`./start.sh restart`

## 性能优化

### 增加 worker 进程

在 `nginx/nginx.conf` 中：

```nginx
worker_processes auto;  # 自动根据 CPU 核心数设置
```

### 调整连接数

```nginx
events {
    worker_connections 2048;  # 增加连接数
}
```

## 安全建议

1. **使用 HTTPS**：生产环境建议配置 SSL 证书
2. **定期更新**：保持 Docker 和 nginx 镜像更新
3. **日志监控**：定期检查访问日志，发现异常访问
4. **防火墙规则**：除了 80 端口，其他端口应该限制访问

## 备份和恢复

### 备份配置

```bash
# 备份配置文件
tar -czf nginx-config-backup-$(date +%Y%m%d).tar.gz docker-compose.yml nginx/
```

### 恢复配置

```bash
# 解压备份
tar -xzf nginx-config-backup-YYYYMMDD.tar.gz

# 重启服务
./start.sh restart
```

## 联系支持

如遇到问题，请检查：

1. Docker 和 Docker Compose 版本
2. nginx 日志文件
3. 开发服务器状态
4. 网络连接情况

---

**最后更新**: 2024年

