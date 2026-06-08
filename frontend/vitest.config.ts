import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
      // hooks/pages のテストで api/client が Cognito を呼ばないようバイパス + MSW モックに乗せる
      env: {
        VITE_DEV_BYPASS_AUTH: 'true',
      },
    },
  }),
)
