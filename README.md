# MES 饮料制造配方编辑器

一个用于定义和管理饮料生产工艺流程的可视化编辑器，支持结构化数据编辑、自动流程图生成和**多人实时协作**。

## 功能特性

### 核心编辑功能

- 📊 **数据表格编辑**: 左侧面板提供可编辑的表格，用于定义工艺步骤
- 🎨 **自动流程图**: 右侧面板实时渲染流程图，使用 Dagre 自动布局
- 🔗 **连接管理**: 支持配置节点间的连接关系和投料顺序
- 🎯 **交互联动**: 表格行和流程图节点支持 Hover 高亮和点击同步
- 💾 **导入导出**: 支持 JSON 格式的导入导出，便于与 MES 系统集成

### 协作功能

- 🤝 **实时协作**: 多人同时编辑，基于 WebSocket 实时同步配方数据
- 🔒 **编辑锁定**: 防止编辑冲突，一键申请/释放编辑权限
- 👥 **在线用户**: 实时显示当前在线编辑人员及其状态
- 🎭 **演示模式**: 适合演示的只读模式，修改不会同步到服务器
- 💾 **自动保存**: 编辑模式下自动定期保存，无需手动操作
- 🔄 **心跳检测**: 监控连接状态，自动释放超时编辑权限

## 技术栈

### 前端

- React 18 + TypeScript
- Vite
- React Flow (流程图可视化)
- Dagre.js (自动布局算法)
- Zustand (状态管理)
- Tailwind CSS + Shadcn/UI (UI组件库)
- Socket.IO Client (实时通信)
- UUID (唯一标识生成)

### 后端

- Node.js + Express
- Socket.IO (WebSocket 服务器)
- SQLite (数据持久化)
- TypeScript

## 快速开始

### 前置要求

- Node.js 18+ 
- npm 或 yarn

### 安装依赖

**前端：**
```bash
npm install
```

**后端：**
```bash
cd server
npm install
```

### 启动开发环境

**1. 启动后端服务器（必需，用于协作功能）**

```bash
cd server
npm run dev
```

服务器将在 `http://localhost:3001` 启动。

**2. 启动前端应用**

```bash
npm run dev
```

前端应用将在 `http://localhost:5173` 启动（或 Vite 配置的端口）。

### 构建生产版本

**前端：**
```bash
npm run build
```

**后端：**
```bash
cd server
npm run build
npm start
```

## 环境配置

### 前端环境变量

创建 `.env` 文件（可选，使用默认值）：

```env
VITE_SOCKET_URL=http://localhost:3001
```

### 后端环境变量

创建 `server/.env` 文件（可选）：

```env
PORT=3001
```

## 使用说明

> 💡 **开发者提示**：如需了解项目结构、技术实现细节和开发指南，请参考 [AI-GUIDE.md](./AI-GUIDE.md)

### 基础操作

1. **添加步骤**: 点击表格底部的"添加步骤"按钮
2. **编辑步骤**: 点击表格单元格进行编辑（需要先申请编辑权限）
3. **配置连接**: 点击"下一步"列的"配置"按钮，在弹出的对话框中添加连接
4. **设置顺序**: 在连接管理器中设置序列顺序（1, 2, 3...），用于多股流汇聚时的投料顺序
5. **导出数据**: 点击顶部栏的"Export JSON"按钮导出配方数据
6. **导入数据**: 点击"Import JSON"按钮导入配方数据（需要编辑权限）

### 协作功能

1. **申请编辑权限**: 
   - 点击顶部栏的"申请编辑"按钮
   - 如果编辑权被其他用户占用，会显示占用者信息
   - 获得编辑权后，按钮变为"释放编辑权"

2. **查看在线用户**:
   - 状态栏会显示当前在线用户数量
   - 点击可查看详细的在线用户列表

3. **演示模式**:
   - 点击"演示模式"按钮切换到只读模式
   - 演示模式下的修改不会同步到服务器
   - 适合用于演示和查看，不会影响其他用户

4. **自动保存**:
   - 获得编辑权限后，系统会自动定期保存
   - 无需手动保存操作

### 注意事项

- 编辑权限会在以下情况自动释放：
  - 15 分钟无操作
  - 30 秒无心跳（网络断开）
  - 主动点击"释放编辑权"
- 演示模式下的修改不会同步到服务器
- 需要确保后端服务器运行才能使用协作功能

## 数据格式

导出的 JSON 格式遵循以下结构：

```json
{
  "metadata": {
    "name": "饮料生产工艺配方",
    "version": "1.0.0",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "nodes": [
    {
      "id": "P1",
      "type": "customProcessNode",
      "data": {
        "label": "糖醇溶解",
        "deviceCode": "TANK_01",
        "ingredients": "糖、水",
        "params": "温度: 60°C, 时间: 30min"
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "e_P1-P6",
      "source": "P1",
      "target": "P6",
      "type": "sequenceEdge",
      "data": {
        "sequenceOrder": 1
      },
      "animated": true
    }
  ]
}
```

## 部署

### GitHub Pages 部署（前端）

项目已配置 GitHub Actions 自动部署到 GitHub Pages。详细步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)。

**快速开始：**

1. 推送代码到 GitHub 仓库
2. 在仓库 Settings → Pages 中启用 GitHub Actions
3. 推送代码到 `main` 分支，自动触发部署

**注意**：如果后端部署在其他服务器，需要在 GitHub Secrets 中设置 `VITE_SOCKET_URL`。

### 前端静态部署

构建后的文件在 `dist/` 目录，可部署到任何静态文件服务器：
- GitHub Pages（已配置自动部署）
- Vercel
- Netlify
- 自有服务器（Nginx、Apache 等）

### 后端部署

后端需要 Node.js 服务器，不能静态部署。推荐平台：
- Railway（推荐，WebSocket 支持好）
- Render
- Vercel（可能需要付费计划）
- 自有服务器（VPS、云服务器）

详细部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)。

### 生产环境配置

- 修改 `VITE_SOCKET_URL` 为实际的后端服务器地址
- 配置 CORS 策略，限制允许的域名
- 配置 HTTPS（WebSocket 在 HTTPS 下使用 WSS）
- 设置适当的数据库备份策略

## 许可证

MIT
