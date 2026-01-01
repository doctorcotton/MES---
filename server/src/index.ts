import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, getRecipe, updateRecipe } from './db';
import { lockManager } from './lockManager';
import { userManager } from './userManager';
import { RecipeData, SocketUser } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // 生产环境应该限制具体域名
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// 初始化数据库
initDatabase();

// 生成用户ID（简化版，实际应该从认证系统获取）
function generateUserId(): string {
  return `user_${uuidv4().substring(0, 8)}`;
}

function generateUserName(): string {
  const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
  return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
}

// HTTP API
app.get('/api/recipe', (req, res) => {
  const recipe = getRecipe();
  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  res.json(recipe);
});

app.get('/api/recipe/lock-status', (req, res) => {
  res.json(lockManager.getLockStatus());
});

app.post('/api/recipe/acquire-lock', (req, res) => {
  const { userId, userName, socketId } = req.body;
  if (!userId || !userName || !socketId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = lockManager.acquireLock({ userId, userName, socketId });
  if (result.success) {
    // 广播锁被获取
    io.emit('lock:acquired', lockManager.getLockStatus());
    res.json({ success: true, lock: lockManager.getLockStatus() });
  } else {
    res.status(409).json({ success: false, message: result.message });
  }
});

app.post('/api/recipe/release-lock', (req, res) => {
  const { userId } = req.body;
  const released = lockManager.releaseLock(userId);
  if (released) {
    // 广播锁被释放
    io.emit('lock:released', lockManager.getLockStatus());
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false, message: 'Failed to release lock' });
  }
});

app.put('/api/recipe', (req, res) => {
  const { userId, recipeData } = req.body;
  if (!userId || !recipeData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 检查用户是否持有锁
  if (!lockManager.isLockedByUser(userId)) {
    return res.status(403).json({ error: 'You do not have the edit lock' });
  }

  const success = updateRecipe('default', recipeData, userId);
  if (success) {
    const updated = getRecipe();
    // 广播更新（除发送者外）
    io.emit('recipe:updated', updated);
    res.json({ success: true, recipe: updated });
  } else {
    res.status(409).json({ error: 'Version conflict or update failed' });
  }
});

// WebSocket连接
io.on('connection', (socket) => {
  const userId = generateUserId();
  const userName = generateUserName();
  const user = userManager.addUser(socket.id, userId, userName);

  console.log(`用户连接: ${userName} (${userId}) - ${socket.id}`);

  // 发送当前状态
  socket.emit('connected', {
    userId,
    userName,
    recipe: getRecipe(),
    lockStatus: lockManager.getLockStatus(),
    onlineUsers: userManager.getAllUsers(),
  });

  // 广播用户上线
  socket.broadcast.emit('user:connected', user);

  // 申请编辑权
  socket.on('lock:acquire', () => {
    const result = lockManager.acquireLock({ userId, userName, socketId: socket.id });
    if (result.success) {
      userManager.updateUserMode(socket.id, 'edit');
      socket.emit('lock:acquired', lockManager.getLockStatus());
      socket.broadcast.emit('lock:acquired', lockManager.getLockStatus());
      io.emit('user:mode-changed', userManager.getUser(socket.id));
    } else {
      socket.emit('lock:acquire-failed', { message: result.message });
    }
  });

  // 释放编辑权
  socket.on('lock:release', () => {
    if (lockManager.releaseLock(userId)) {
      userManager.updateUserMode(socket.id, 'view');
      socket.emit('lock:released', lockManager.getLockStatus());
      socket.broadcast.emit('lock:released', lockManager.getLockStatus());
      io.emit('user:mode-changed', userManager.getUser(socket.id));
    }
  });

  // 心跳
  socket.on('heartbeat', () => {
    lockManager.updateHeartbeat(socket.id);
    socket.emit('heartbeat:ack');
  });

  // 更新配方数据（需要持有锁）
  socket.on('recipe:update', (data: RecipeData) => {
    if (!lockManager.isLockedByUser(userId)) {
      socket.emit('recipe:update-failed', { message: 'You do not have the edit lock' });
      return;
    }

    const success = updateRecipe('default', data, userId);
    if (success) {
      const updated = getRecipe();
      // 广播更新（除发送者外）
      socket.broadcast.emit('recipe:updated', updated);
      socket.emit('recipe:update-success', updated);
    } else {
      socket.emit('recipe:update-failed', { message: 'Version conflict' });
    }
  });

  // 切换到演示模式
  socket.on('mode:demo', () => {
    userManager.updateUserMode(socket.id, 'demo');
    io.emit('user:mode-changed', userManager.getUser(socket.id));
  });

  // 退出演示模式
  socket.on('mode:view', () => {
    userManager.updateUserMode(socket.id, 'view');
    io.emit('user:mode-changed', userManager.getUser(socket.id));
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开: ${userName} (${userId}) - ${socket.id}`);
    const disconnectedUser = userManager.removeUser(socket.id);
    lockManager.handleDisconnect(socket.id);
    socket.broadcast.emit('user:disconnected', disconnectedUser);
    
    // 如果锁的持有者断开，广播锁释放
    if (lockManager.getLockStatus().isLocked === false) {
      io.emit('lock:released', lockManager.getLockStatus());
    }
  });
});

// 定期检查并清理过期锁
setInterval(() => {
  const lockStatus = lockManager.getLockStatus();
  if (lockStatus.isLocked && lockManager.isLockExpired()) {
    lockManager.releaseLock();
    io.emit('lock:released', lockManager.getLockStatus());
  }
}, 10000); // 每10秒检查一次

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
