import { EditLock, SocketUser } from './types';

class LockManager {
  private lock: EditLock = {
    isLocked: false,
    userId: null,
    userName: null,
    socketId: null,
    acquiredAt: null,
    lastHeartbeat: null,
  };

  private readonly LOCK_TIMEOUT = 15 * 60 * 1000; // 15分钟
  private readonly HEARTBEAT_TIMEOUT = 30 * 1000; // 30秒无心跳视为断开

  acquireLock(user: SocketUser): { success: boolean; message?: string } {
    // 检查锁是否被占用
    if (this.lock.isLocked) {
      // 检查锁是否超时
      if (this.isLockExpired()) {
        this.releaseLock(); // 自动释放过期锁
      } else {
        return {
          success: false,
          message: `编辑权已被 ${this.lock.userName} 占用`,
        };
      }
    }

    this.lock = {
      isLocked: true,
      userId: user.userId,
      userName: user.userName,
      socketId: user.socketId,
      acquiredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };

    return { success: true };
  }

  releaseLock(userId?: string): boolean {
    if (!this.lock.isLocked) return false;

    // 如果指定了userId，只有锁的持有者才能释放
    if (userId && this.lock.userId !== userId) {
      return false;
    }

    this.lock = {
      isLocked: false,
      userId: null,
      userName: null,
      socketId: null,
      acquiredAt: null,
      lastHeartbeat: null,
    };

    return true;
  }

  updateHeartbeat(socketId: string): boolean {
    if (!this.lock.isLocked || this.lock.socketId !== socketId) {
      return false;
    }

    this.lock.lastHeartbeat = new Date().toISOString();
    return true;
  }

  getLockStatus(): EditLock {
    // 检查并清理过期锁
    if (this.lock.isLocked && this.isLockExpired()) {
      this.releaseLock();
    }

    return { ...this.lock };
  }

  isLockExpired(): boolean {
    if (!this.lock.isLocked || !this.lock.acquiredAt) return false;

    const now = Date.now();
    const acquiredAt = new Date(this.lock.acquiredAt).getTime();
    const lastHeartbeat = this.lock.lastHeartbeat
      ? new Date(this.lock.lastHeartbeat).getTime()
      : acquiredAt;

    // 检查总锁定时间是否超时
    if (now - acquiredAt > this.LOCK_TIMEOUT) {
      return true;
    }

    // 检查心跳是否超时
    if (now - lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
      return true;
    }

    return false;
  }

  handleDisconnect(socketId: string): boolean {
    if (this.lock.isLocked && this.lock.socketId === socketId) {
      // 延迟释放锁，给重连机会
      setTimeout(() => {
        if (this.lock.socketId === socketId) {
          this.releaseLock();
        }
      }, 30000); // 30秒后释放
      return true;
    }
    return false;
  }

  isLockedByUser(userId: string): boolean {
    return this.lock.isLocked && this.lock.userId === userId;
  }
}

export const lockManager = new LockManager();
