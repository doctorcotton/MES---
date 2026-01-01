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

服务器将在 `http://localhost:3001` 启动。

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

- `PORT` - 服务器端口（默认：3001）
