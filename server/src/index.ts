import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, getRecipe, updateRecipe, getFieldConfigs, getFieldConfig, createFieldConfig, updateFieldConfig, deleteFieldConfig } from './db';
import { lockManager } from './lockManager';
import { userManager } from './userManager';
import { RecipeData, SocketUser } from './types';
import { getLocalIP } from './utils/network';

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

// HTTP API 接口
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
  const { userId, socketId, recipeData } = req.body;
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
    // 广播更新（排除提交者，避免提交者收到自己刚保存的数据导致引用抖动）
    if (socketId) {
      // 如果提供了 socketId，只广播给其他客户端
      io.except(socketId).emit('recipe:updated', updated);
    } else {
      // 如果没有 socketId（向后兼容），广播给所有人
      io.emit('recipe:updated', updated);
    }
    res.json({ success: true, recipe: updated });
  } else {
    res.status(409).json({ error: 'Version conflict or update failed' });
  }
});


// === 配置 API ===

app.get('/api/config/fields/type/:processType', (req, res) => {
  const configs = getFieldConfigs(req.params.processType);
  res.json(configs);
});

app.get('/api/config/fields', (req, res) => {
  const configs = getFieldConfigs();
  res.json(configs);
});

app.post('/api/config/fields', (req, res) => {
  const config = req.body;

  // 基本验证
  if (!config.processType || !config.key || !config.label || !config.inputType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 全局 key 查重
  const existing = getFieldConfigs().find(c => c.key === config.key);
  if (existing) {
    return res.status(409).json({
      error: `字段 key "${config.key}" 已存在（工艺类型: ${existing.processType}）`,
      duplicateKey: config.key,
      existingProcessType: existing.processType
    });
  }

  // 如果缺少 ID 则生成
  if (!config.id) {
    config.id = uuidv4();
  }

  const now = new Date().toISOString();
  config.createdAt = now;
  config.updatedAt = now;
  config.enabled = config.enabled !== false; // Default true
  config.isSystem = false; // API 创建的字段不是系统默认字段

  try {
    const success = createFieldConfig(config);
    if (success) {
      res.json({ success: true, config });
    } else {
      res.status(500).json({ error: 'Failed to create config' });
    }
  } catch (err: any) {
    res.status(409).json({ error: err.message || 'Create failed (duplicate key?)' });
  }
});

app.put('/api/config/fields/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  updates.updatedAt = new Date().toISOString();

  try {
    const success = updateFieldConfig(id, updates);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Config not found or no changes' });
    }
  } catch (err: any) {
    console.error('Failed to update field config:', {
      id,
      updates,
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/config/fields/:id', (req, res) => {
  const id = req.params.id;
  try {
    const success = deleteFieldConfig(id);
    if (success) {
      res.json({ success: true });
    } else {
      // 检查是否因为它是系统字段而失败
      const config = getFieldConfig(id);
      if (config && config.isSystem) {
        return res.status(403).json({ error: 'Cannot delete system field' });
      }
      res.status(404).json({ error: 'Config not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/sync', (req, res) => {
  // 这主要用于手动触发/测试，迁移在启动时运行
  try {
    const { syncDefaultFields } = require('./migrations/syncDefaultFields');
    syncDefaultFields();
    res.json({ success: true, message: 'Sync completed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// WebSocket连接
io.on('connection', (socket) => {
  // 优先使用客户端通过 auth 提供的 userId 和 userName
  const clientUserId = socket.handshake.auth?.userId;
  const clientUserName = socket.handshake.auth?.userName;

  const userId = clientUserId || generateUserId();
  const userName = clientUserName || generateUserName();

  // 获取客户端 IP 地址
  const forwardedFor = socket.handshake.headers['x-forwarded-for'];
  let clientIp = forwardedFor
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
    : socket.handshake.address;
  // 处理 IPv6 格式的本地地址
  if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    clientIp = '127.0.0.1';
  } else if (clientIp?.startsWith('::ffff:')) {
    clientIp = clientIp.replace('::ffff:', '');
  }

  const user = userManager.addUser(socket.id, userId, userName, clientIp);

  console.log(`用户连接: ${userName} (${userId}) - ${socket.id} - IP: ${clientIp}`, {
    fromClient: !!clientUserId,
  });

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

/**
 * 发送飞书 Webhook 通知
 */
async function sendFeishuWebhook(hostIP: string, backendPort: number): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL || 'https://k11pnjpvz1.feishu.cn/base/workflow/webhook/event/IGolaXSBbwNnxsh5FSOc9K82njh';
  const serviceName = process.env.SERVICE_NAME || 'MES配方编辑器';

  // 如果 webhook URL 未配置，跳过发送
  if (!webhookUrl || webhookUrl.trim() === '') {
    console.log('  Webhook URL 未配置，跳过通知');
    return;
  }

  // 获取前端地址
  // 优先使用 FRONTEND_URL，如果没有则使用 FRONTEND_PORT，最后默认 5173
  let frontendUrl: string;
  if (process.env.FRONTEND_URL) {
    frontendUrl = process.env.FRONTEND_URL;
  } else {
    const frontendPort = parseInt(process.env.FRONTEND_PORT || '5173', 10);
    frontendUrl = `http://${hostIP}:${frontendPort}`;
  }

  // 格式化启动时间
  const now = new Date();
  const startTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // 从 frontendUrl 中提取端口
  const frontendPortMatch = frontendUrl.match(/:(\d+)/);
  const frontendPort = frontendPortMatch ? parseInt(frontendPortMatch[1], 10) : 5173;

  const payload = {
    service_name: serviceName,
    service_url: frontendUrl,
    host_ip: hostIP,
    port: frontendPort,
    start_time: startTime,
    status: 'started'
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`  飞书通知发送成功: ${response.status}`);
    } else {
      console.error(`  飞书通知发送失败: ${response.status} ${response.statusText}`);
    }
  } catch (error: any) {
    // Webhook 失败不应阻止服务器启动
    console.error(`  飞书通知发送失败: ${error.message}`);
  }
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0'; // 绑定到所有网络接口，允许局域网访问

httpServer.listen(PORT, HOST, async () => {
  const localIP = getLocalIP();
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`局域网访问地址: http://${localIP}:${PORT}`);

  // 发送 webhook 通知（异步，不阻塞启动）
  sendFeishuWebhook(localIP, PORT).catch(err => {
    console.error('Webhook 发送异常:', err);
  });
});
