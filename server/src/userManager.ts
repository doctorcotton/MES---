import { OnlineUser, SocketUser } from './types';

class UserManager {
  private users: Map<string, OnlineUser> = new Map(); // socketId -> user

  addUser(socketId: string, userId: string, userName: string, ip?: string): OnlineUser {
    const user: OnlineUser = {
      userId,
      userName,
      socketId,
      mode: 'view',
      connectedAt: new Date().toISOString(),
      ip,
    };
    this.users.set(socketId, user);
    return user;
  }

  removeUser(socketId: string): OnlineUser | null {
    const user = this.users.get(socketId);
    if (user) {
      this.users.delete(socketId);
    }
    return user || null;
  }

  getUser(socketId: string): OnlineUser | null {
    return this.users.get(socketId) || null;
  }

  updateUserMode(socketId: string, mode: 'view' | 'edit' | 'demo'): boolean {
    const user = this.users.get(socketId);
    if (!user) return false;
    user.mode = mode;
    return true;
  }

  getAllUsers(): OnlineUser[] {
    return Array.from(this.users.values());
  }

  getUsersCount(): number {
    return this.users.size;
  }
}

export const userManager = new UserManager();
