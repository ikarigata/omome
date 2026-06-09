import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // dev では SW を無効（MSW の mockServiceWorker.js と競合させない）。本番ビルドでのみ有効。
      devOptions: { enabled: false },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'omome',
        short_name: 'omome',
        description: 'トレーニング記録アプリ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F1EFDF',
        theme_color: '#E86029',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // アプリシェル（JS/CSS/HTML/画像/フォント）をプリキャッシュ。API はキャッシュしない（案A）。
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
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
