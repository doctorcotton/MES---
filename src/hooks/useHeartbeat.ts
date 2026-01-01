import { useEffect, useRef } from 'react';
import { socketService } from '../services/socketService';
import { useCollabStore } from '../store/useCollabStore';

const HEARTBEAT_INTERVAL = 10000; // 10秒

export function useHeartbeat() {
  const { mode } = useCollabStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || mode !== 'edit') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 发送心跳
    const sendHeartbeat = () => {
      socket.emit('heartbeat');
    };

    // 立即发送一次
    sendHeartbeat();

    // 设置定时器
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode]);
}
