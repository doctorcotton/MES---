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
  // GitHub Pages 部署配置
  // 如果仓库名不是根路径，需要设置 base
  // 例如：base: '/MES---/' （替换为你的仓库名）
  // 如果部署在自定义域名，可以设置为 '/'
  base: process.env.GITHUB_PAGES === 'true' ? '/MES---/' : '/',
})
