import { describe, it, expect, vi, afterEach } from 'vitest'

// devFlags はモジュール読み込み時に import.meta.env を評価するため、
// resetModules + stubEnv で各ケースを再読み込みして検証する。
describe('devFlags', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('VITE_DEV_BYPASS_AUTH=true で DEV_BYPASS_AUTH / USE_MOCKS が true', async () => {
    vi.stubEnv('VITE_DEV_BYPASS_AUTH', 'true')
    vi.resetModules()
    const m = await import('../devFlags')
    expect(m.DEV_BYPASS_AUTH).toBe(true)
    expect(m.USE_MOCKS).toBe(true)
  })

  it('未設定（空）なら false', async () => {
    vi.stubEnv('VITE_DEV_BYPASS_AUTH', '')
    vi.resetModules()
    const m = await import('../devFlags')
    expect(m.DEV_BYPASS_AUTH).toBe(false)
    expect(m.USE_MOCKS).toBe(false)
  })

  it('"true" 以外の値は false', async () => {
    vi.stubEnv('VITE_DEV_BYPASS_AUTH', '1')
    vi.resetModules()
    const m = await import('../devFlags')
    expect(m.DEV_BYPASS_AUTH).toBe(false)
  })
})
