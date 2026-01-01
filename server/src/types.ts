import { RecipeNode, RecipeEdge } from '../../src/types/recipe';

export interface RecipeData {
  id: string;
  metadata: {
    name: string;
    version: string;
    updatedAt: string;
  };
  nodes: RecipeNode[];
  edges: RecipeEdge[];
  version: number; // 乐观锁版本号
  updatedBy: string | null;
}

export interface EditLock {
  isLocked: boolean;
  userId: string | null;
  userName: string | null;
  socketId: string | null;
  acquiredAt: string | null;
  lastHeartbeat: string | null;
}

export interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  mode: 'view' | 'edit' | 'demo';
  connectedAt: string;
}

export interface SocketUser {
  userId: string;
  userName: string;
  socketId: string;
}
