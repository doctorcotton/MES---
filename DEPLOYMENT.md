# 部署指南

## GitHub Pages 部署（前端）

### 前置条件

1. 将代码推送到 GitHub 仓库
2. 在 GitHub 仓库设置中启用 GitHub Pages：
   - 进入 Settings → Pages
   - Source 选择 "GitHub Actions"

### 自动部署

项目已配置 GitHub Actions 工作流，当你推送代码到 `main` 分支时，会自动构建并部署前端到 GitHub Pages。

### 手动部署

1. 在 GitHub 仓库页面，点击 "Actions" 标签
2. 选择 "Deploy to GitHub Pages" 工作流
3. 点击 "Run workflow" 手动触发部署

### 配置后端服务器地址

如果后端部署在其他服务器，需要设置环境变量：

1. 在 GitHub 仓库中，进入 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加名为 `VITE_SOCKET_URL` 的 secret，值为你的后端服务器地址
   - 例如：`https://your-backend-server.com`
   - 注意：如果使用 HTTPS，WebSocket 会自动使用 WSS

### 更新仓库名称

如果你的 GitHub 仓库名称不是 `MES---`，需要修改：

1. 编辑 `vite.config.ts`，将 `base` 路径改为你的仓库名：
   ```typescript
   base: process.env.GITHUB_PAGES === 'true' ? '/你的仓库名/' : '/',
   ```

2. 或者在 GitHub Actions 工作流中添加环境变量：
   ```yaml
   env:
     GITHUB_PAGES: 'true'
   ```

## 后端部署选项

GitHub Pages 只支持静态文件，后端需要部署到其他平台。以下是推荐选项：

### 选项 1: Vercel（推荐）

Vercel 支持 Node.js 服务器，配置简单：

1. 将后端代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 设置根目录为 `server`
4. 配置环境变量：
   - `PORT` (可选，Vercel 会自动分配)
5. 部署后，更新前端的 `VITE_SOCKET_URL` 为 Vercel 提供的地址

**注意**：Vercel 的免费计划对 WebSocket 支持有限，可能需要升级到付费计划。

### 选项 2: Railway

Railway 对 WebSocket 支持良好：

1. 在 [Railway](https://railway.app) 创建新项目
2. 从 GitHub 导入仓库
3. 设置根目录为 `server`
4. 配置环境变量
5. 部署后获取 URL，更新前端的 `VITE_SOCKET_URL`

### 选项 3: Render

Render 也支持 WebSocket：

1. 在 [Render](https://render.com) 创建新的 Web Service
2. 连接 GitHub 仓库
3. 设置：
   - Root Directory: `server`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. 配置环境变量
5. 部署后更新前端的 `VITE_SOCKET_URL`

### 选项 4: 自有服务器

如果使用自有服务器（VPS、云服务器等）：

1. 安装 Node.js 18+
2. 克隆仓库
3. 进入 `server` 目录，安装依赖：`npm install`
4. 构建项目：`npm run build`
5. 使用 PM2 管理进程：
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name mes-server
   pm2 save
   pm2 startup
   ```
6. 配置 Nginx 反向代理（支持 WebSocket）：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 完整部署流程示例

### 场景：前端 GitHub Pages + 后端 Railway

1. **部署后端到 Railway**：
   - 在 Railway 创建项目，连接 GitHub 仓库
   - 设置根目录为 `server`
   - 部署后获取 URL，例如：`https://mes-server.railway.app`

2. **配置前端环境变量**：
   - 在 GitHub 仓库设置中添加 Secret：
     - Name: `VITE_SOCKET_URL`
     - Value: `https://mes-server.railway.app`

3. **触发前端部署**：
   - 推送代码到 `main` 分支，或手动触发 GitHub Actions

4. **访问应用**：
   - 前端地址：`https://你的用户名.github.io/MES---/`
   - 确保前端能连接到后端服务器

## 注意事项

1. **CORS 配置**：确保后端允许来自 GitHub Pages 域名的请求
   - 编辑 `server/src/index.ts`，修改 CORS 配置：
   ```typescript
   cors: {
     origin: ['https://你的用户名.github.io', 'http://localhost:5173'],
     methods: ['GET', 'POST'],
   }
   ```

2. **HTTPS/WSS**：如果前端使用 HTTPS，后端也必须使用 HTTPS（WSS）

3. **数据库持久化**：如果使用 SQLite，确保部署平台支持文件系统持久化
   - Railway、Render 等平台可能需要使用外部数据库（如 PostgreSQL）

4. **环境变量**：生产环境不要使用默认的 `localhost:3001`

## 故障排查

### 前端无法连接后端

1. 检查 `VITE_SOCKET_URL` 是否正确设置
2. 检查后端服务器是否运行
3. 检查浏览器控制台的错误信息
4. 检查 CORS 配置

### WebSocket 连接失败

1. 确保后端支持 WebSocket（Socket.IO）
2. 如果使用反向代理，确保配置了 WebSocket 升级
3. 检查防火墙设置

### 部署后页面空白

1. 检查 `vite.config.ts` 中的 `base` 路径是否正确
2. 检查构建是否成功
3. 查看浏览器控制台的 404 错误

