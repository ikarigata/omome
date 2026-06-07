import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,           // 0.0.0.0 バインド。コンテナ外（ホスト→tailscale）から到達できるように
    port: 5173,
    allowedHosts: true,   // tailscale の *.ts.net ドメイン経由のアクセスを許可（未設定だと Vite が Blocked request で弾く）
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
