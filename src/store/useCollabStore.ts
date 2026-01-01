import { create } from 'zustand';

export type CollaborationMode = 'view' | 'edit' | 'demo';

export interface EditLock {
  isLocked: boolean;
  userId: string | null;
  userName: string | null;
  acquiredAt: string | null;
  lastHeartbeat: string | null;
}

export interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  mode: CollaborationMode;
  connectedAt: string;
}

interface CollabStore {
  // 用户信息
  userId: string | null;
  userName: string | null;
  
  // 当前模式
  mode: CollaborationMode;
  
  // 编辑锁状态
  lockStatus: EditLock;
  
  // 在线用户
  onlineUsers: OnlineUser[];
  
  // 连接状态
  isConnected: boolean;
  
  // Actions
  setUser: (userId: string, userName: string) => void;
  setMode: (mode: CollaborationMode) => void;
  setLockStatus: (lock: EditLock) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  updateOnlineUser: (user: OnlineUser) => void;
  removeOnlineUser: (socketId: string) => void;
  setConnected: (connected: boolean) => void;
  
  // 计算属性
  isEditable: () => boolean;
  isLockedByMe: () => boolean;
  getOnlineUsersCount: () => number;
}

export const useCollabStore = create<CollabStore>((set, get) => ({
  userId: null,
  userName: null,
  mode: 'view',
  lockStatus: {
    isLocked: false,
    userId: null,
    userName: null,
    acquiredAt: null,
    lastHeartbeat: null,
  },
  onlineUsers: [],
  isConnected: false,

  setUser: (userId, userName) => {
    set({ userId, userName });
  },

  setMode: (mode) => {
    set({ mode });
  },

  setLockStatus: (lockStatus) => {
    set({ lockStatus });
  },

  setOnlineUsers: (onlineUsers) => {
    set({ onlineUsers });
  },

  updateOnlineUser: (user) => {
    set((state) => {
      const existingIndex = state.onlineUsers.findIndex((u) => u.socketId === user.socketId);
      if (existingIndex >= 0) {
        const updated = [...state.onlineUsers];
        updated[existingIndex] = user;
        return { onlineUsers: updated };
      } else {
        return { onlineUsers: [...state.onlineUsers, user] };
      }
    });
  },

  removeOnlineUser: (socketId) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((u) => u.socketId !== socketId),
    }));
  },

  setConnected: (isConnected) => {
    set({ isConnected });
  },

  isEditable: () => {
    const state = get();
    return state.mode === 'edit' && state.isLockedByMe();
  },

  isLockedByMe: () => {
    const state = get();
    return state.lockStatus.isLocked && state.lockStatus.userId === state.userId;
  },

  getOnlineUsersCount: () => {
    return get().onlineUsers.length;
  },
}));
