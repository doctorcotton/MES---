import { useEffect, useRef } from 'react';
import { socketService } from '../services/socketService';
import { useRecipeStore } from '../store/useRecipeStore';
import { useCollabStore } from '../store/useCollabStore';
import { RecipeSchema } from '../types/recipe';

export function useSocketSync() {
  const { syncFromServer } = useRecipeStore();
  const { setOnlineUsers, updateOnlineUser, removeOnlineUser, setLockStatus, setConnected } = useCollabStore();
  const listenersRegisteredRef = useRef(false);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || listenersRegisteredRef.current) {
      return;
    }

    // 连接成功
    const handleConnected = (data: {
      userId: string;
      userName: string;
      recipe: RecipeSchema & { version: number };
      lockStatus: any;
      onlineUsers: any[];
    }) => {
      setConnected(true);
      if (data.recipe) {
        syncFromServer(data.recipe, data.recipe.version || 1);
      }
      if (data.lockStatus) {
        setLockStatus(data.lockStatus);
      }
      if (data.onlineUsers) {
        setOnlineUsers(data.onlineUsers);
      }
    };

    // 配方更新（来自服务器或其他用户）
    const handleRecipeUpdated = (recipe: RecipeSchema & { version: number }) => {
      // 只同步非自己发送的更新
      syncFromServer(recipe, recipe.version || 1);
    };

    // 锁状态变化
    const handleLockAcquired = (lock: any) => {
      setLockStatus(lock);
    };

    const handleLockReleased = (lock: any) => {
      setLockStatus(lock);
    };

    // 用户上线/下线
    const handleUserConnected = (user: any) => {
      updateOnlineUser(user);
    };

    const handleUserDisconnected = (user: any) => {
      if (user) {
        removeOnlineUser(user.socketId);
      }
    };

    const handleUserModeChanged = (user: any) => {
      if (user) {
        updateOnlineUser(user);
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    // 注册事件监听（只注册一次）
    socket.on('connected', handleConnected);
    socket.on('recipe:updated', handleRecipeUpdated);
    socket.on('lock:acquired', handleLockAcquired);
    socket.on('lock:released', handleLockReleased);
    socket.on('user:connected', handleUserConnected);
    socket.on('user:disconnected', handleUserDisconnected);
    socket.on('user:mode-changed', handleUserModeChanged);
    socket.on('disconnect', handleDisconnect);

    listenersRegisteredRef.current = true;

    return () => {
      // 清理所有事件监听器
      socket.off('connected', handleConnected);
      socket.off('recipe:updated', handleRecipeUpdated);
      socket.off('lock:acquired', handleLockAcquired);
      socket.off('lock:released', handleLockReleased);
      socket.off('user:connected', handleUserConnected);
      socket.off('user:disconnected', handleUserDisconnected);
      socket.off('user:mode-changed', handleUserModeChanged);
      socket.off('disconnect', handleDisconnect);
      listenersRegisteredRef.current = false;
    };
  }, [syncFromServer, setOnlineUsers, updateOnlineUser, removeOnlineUser, setLockStatus, setConnected]);
}
