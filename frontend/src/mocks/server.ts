import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// テスト（node 環境）用の MSW サーバ。ブラウザ用 worker と同じ handlers を流用する。
export const server = setupServer(...handlers)
