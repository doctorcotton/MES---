import { useEffect } from 'react';
import { socketService } from '../services/socketService';
import { useCollabStore } from '../store/useCollabStore';

export function useEditLock() {
  const { userId, lockStatus, setLockStatus, setMode, isLockedByMe } = useCollabStore();

  const acquireLock = async () => {
    if (!userId) return { success: false, message: '用户未登录' };

    try {
      const response = await fetch('http://localhost:3001/api/recipe/acquire-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName: useCollabStore.getState().userName,
          socketId: socketService.getSocket()?.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setLockStatus(data.lock);
        setMode('edit');
        socketService.emit('lock:acquire');
        return { success: true };
      } else {
        return { success: false, message: data.message || '获取编辑权失败' };
      }
    } catch (error) {
      console.error('获取编辑权失败:', error);
      return { success: false, message: '网络错误' };
    }
  };

  const releaseLock = async () => {
    if (!userId) return { success: false };

    try {
      const response = await fetch('http://localhost:3001/api/recipe/release-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (data.success) {
        setMode('view');
        socketService.emit('lock:release');
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error('释放编辑权失败:', error);
      return { success: false };
    }
  };

  // 监听锁状态变化
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleLockAcquired = (lock: typeof lockStatus) => {
      setLockStatus(lock);
      if (lock.userId === userId) {
        setMode('edit');
      }
    };

    const handleLockReleased = (lock: typeof lockStatus) => {
      setLockStatus(lock);
      if (!lock.isLocked) {
        setMode('view');
      }
    };

    socket.on('lock:acquired', handleLockAcquired);
    socket.on('lock:released', handleLockReleased);

    return () => {
      socket.off('lock:acquired', handleLockAcquired);
      socket.off('lock:released', handleLockReleased);
    };
  }, [userId]);

  return {
    acquireLock,
    releaseLock,
    isLocked: lockStatus.isLocked,
    isLockedByMe: isLockedByMe(),
    lockHolder: lockStatus.userName,
  };
}
