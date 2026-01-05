import { io, Socket } from 'socket.io-client';


const SOCKET_URL = (import.meta as any).env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(_userId: string, _userName: string): Socket {
    // 如果已连接，直接返回现有socket
    if (this.socket?.connected) {
      return this.socket;
    }

    // 如果socket存在但未连接，先断开并清理
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // 创建新连接,通过 auth 参数传递 userId 和 userName
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        userId: _userId,
        userName: _userName,
      },
    });

    this.socket.on('connect', () => {
      console.log('Socket连接成功');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket断开连接:', reason);
      // 如果是主动断开，不重连
      if (reason === 'io client disconnect') {
        this.socket = null;
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket连接错误:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('达到最大重连次数，停止重连');
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // 事件监听器
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  // 发送事件
  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }
}

export const socketService = new SocketService();
