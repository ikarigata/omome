import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from '@/app/providers'
import { configureAmplify } from '@/auth/cognito'
import { USE_MOCKS } from '@/lib/devFlags'
import App from './App'
import './styles/index.css'

async function bootstrap() {
  // 見た目確認モード: MSW で API をモックしてから起動
  if (USE_MOCKS) {
    const { startMockWorker } = await import('./mocks/browser')
    await startMockWorker()
  }

  configureAmplify()

  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element not found')

  createRoot(rootEl).render(
    <StrictMode>
      <Providers>
        <App />
      </Providers>
    </StrictMode>,
  )
}

void bootstrap()
