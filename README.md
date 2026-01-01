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

## 项目结构

```
src/
├── components/
│   ├── ui/              # Shadcn UI 组件
│   ├── editor/          # 编辑器组件
│   │   ├── RecipeTable.tsx      # 数据表格
│   │   └── ConnectionModal.tsx  # 连接管理器
│   ├── graph/           # 流程图组件
│   │   ├── RecipeFlow.tsx       # 流程图主组件
│   │   ├── CustomNode.tsx       # 自定义节点
│   │   └── SequenceEdge.tsx     # 带顺序标识的连线
│   ├── collab/          # 协作功能组件
│   │   ├── EditLockButton.tsx   # 编辑锁定按钮
│   │   ├── OnlineUsers.tsx      # 在线用户列表
│   │   ├── DemoModeButton.tsx   # 演示模式切换
│   │   ├── DemoModeBanner.tsx   # 演示模式横幅
│   │   └── StatusBar.tsx        # 状态栏
│   └── layout/          # 布局组件
│       └── AppLayout.tsx        # 应用主布局
├── hooks/               # 自定义 Hooks
│   ├── useAutoLayout.ts         # 自动布局
│   ├── useSocketSync.ts         # WebSocket 实时同步
│   ├── useEditLock.ts           # 编辑权限锁定
│   ├── useAutoSave.ts           # 自动保存
│   ├── useDemoMode.ts           # 演示模式
│   └── useHeartbeat.ts          # 心跳检测
├── store/               # Zustand 状态管理
│   ├── useRecipeStore.ts        # 配方数据状态
│   └── useCollabStore.ts        # 协作状态
├── services/            # 服务层
│   └── socketService.ts         # Socket.IO 服务
├── types/               # TypeScript 类型定义
├── data/                # 初始数据
└── lib/                 # 工具函数

server/
├── src/
│   ├── index.ts         # Express + Socket.IO 服务器
│   ├── db.ts            # SQLite 数据库操作
│   ├── lockManager.ts   # 编辑锁管理
│   ├── userManager.ts   # 用户管理
│   └── types.ts         # 类型定义
└── package.json
```

## 使用说明

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

## 开发指南

### 本地开发

1. 克隆项目
2. 安装前后端依赖
3. 启动后端服务器：`cd server && npm run dev`
4. 启动前端应用：`npm run dev`
5. 打开浏览器访问前端地址

### 测试多人协作

1. 打开多个浏览器标签页或不同浏览器
2. 每个标签页会自动分配不同的用户身份
3. 测试编辑权限申请/释放
4. 测试实时数据同步

## 部署

### 前端部署

构建后的文件在 `dist/` 目录，可部署到任何静态文件服务器（如 Nginx、Vercel、Netlify）。

### 后端部署

1. 构建项目：`cd server && npm run build`
2. 启动服务：`npm start`
3. 建议使用 PM2 或类似工具管理进程
4. 配置反向代理（如 Nginx）处理 WebSocket 连接

### 生产环境配置

- 修改 `VITE_SOCKET_URL` 为实际的后端服务器地址
- 配置 CORS 策略，限制允许的域名
- 配置 HTTPS（WebSocket 在 HTTPS 下使用 WSS）
- 设置适当的数据库备份策略

## 许可证

MIT
