import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 开发服务器配置
  server: {
    host: '0.0.0.0', // 允许通过 IP 地址访问，支持局域网访问
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    strictPort: false, // 如果端口被占用，尝试下一个可用端口
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok-free.dev'], // 允许 ngrok 代理域名
    proxy: {
      // 将前端的 /api 请求代理到本机的后端服务
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // 将前端的 /socket.io WebSocket 连接代理到本机的后端服务
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true, // 启用 WebSocket 代理
      },
    },
  },
})
