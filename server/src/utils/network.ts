import os from 'os';

/**
 * 获取本机局域网 IP 地址
 * @returns 局域网 IP 地址，如果无法获取则返回 'localhost'
 */
export function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const networkInterface = interfaces[name];
    if (!networkInterface) continue;
    
    for (const iface of networkInterface) {
      // 查找 IPv4 地址且不是内部地址（127.0.0.1）
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  // 如果找不到局域网 IP，返回 localhost
  return 'localhost';
}

