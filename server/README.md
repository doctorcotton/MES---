# MES配方编辑器 - 后端服务器

## 快速开始

### 安装依赖

```bash
cd server
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3001` 启动，并自动绑定到 `0.0.0.0` 以支持局域网访问。

### 构建生产版本

```bash
npm run build
npm start
```

## API 端点

### HTTP API

- `GET /api/recipe` - 获取当前配方数据
- `GET /api/recipe/lock-status` - 查询编辑锁状态
- `POST /api/recipe/acquire-lock` - 申请编辑权
- `POST /api/recipe/release-lock` - 释放编辑权
- `PUT /api/recipe` - 保存配方数据（需要持有锁）

### WebSocket 事件

**客户端发送：**
- `lock:acquire` - 申请编辑权
- `lock:release` - 释放编辑权
- `heartbeat` - 心跳
- `recipe:update` - 更新配方（需要持有锁）
- `mode:demo` - 切换到演示模式
- `mode:view` - 退出演示模式

**服务器发送：**
- `connected` - 连接成功（包含初始数据）
- `recipe:updated` - 配方数据更新
- `lock:acquired` - 编辑权被获取
- `lock:released` - 编辑权被释放
- `user:connected` - 用户上线
- `user:disconnected` - 用户下线
- `user:mode-changed` - 用户模式改变
- `heartbeat:ack` - 心跳确认

## 数据库

使用 SQLite 数据库存储配方数据，数据库文件为 `recipe.db`。

## 环境变量

- `PORT` - 后端服务器端口（默认：3001）
- `WEBHOOK_URL` - 飞书 Webhook URL，用于发送服务启动通知（可选）
- `SERVICE_NAME` - 服务名称，用于 Webhook 通知（默认："MES配方编辑器"）
- `FRONTEND_URL` - 前端完整访问地址（可选，优先级最高）
- `FRONTEND_PORT` - 前端端口号（默认：5173，仅在未设置 FRONTEND_URL 时使用）

### 示例

```bash
# 设置自定义端口和服务名称
PORT=3001 SERVICE_NAME="MES配方编辑器" npm run dev

# 配置 Webhook 通知（使用默认前端端口 5173）
WEBHOOK_URL="https://your-webhook-url.com" SERVICE_NAME="我的服务" npm run dev

# 配置自定义前端端口
FRONTEND_PORT=8080 WEBHOOK_URL="https://your-webhook-url.com" npm run dev

# 配置完整前端 URL（适用于部署在 GitHub Pages 或其他域名）
FRONTEND_URL="https://your-username.github.io/MES---/" WEBHOOK_URL="https://your-webhook-url.com" npm run dev
```

服务器启动时会自动：
- 绑定到 `0.0.0.0`，允许局域网内其他设备访问
- 获取本机局域网 IP 地址
- 如果配置了 `WEBHOOK_URL`，会发送包含服务信息的通知到飞书多维表格
