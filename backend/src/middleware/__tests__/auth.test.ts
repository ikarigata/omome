import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { createAuthMiddleware } from '../auth.js'
import { createMockUsersRepository } from '../../test/mockRepositories.js'
import type { HonoEnv } from '../../types.js'

function buildApp(usersRepo = createMockUsersRepository()) {
  const app = new Hono<HonoEnv>()
  app.use('*', createAuthMiddleware({ usersRepo }))
  app.get('/probe', (c) => c.json({ userId: c.get('userId') }))
  return { app, usersRepo }
}

function envWithSub(sub?: string) {
  return {
    event: {
      requestContext: sub ? { authorizer: { jwt: { claims: { sub } } } } : {},
    },
    lambdaContext: {},
  } as unknown as HonoEnv['Bindings']
}

describe('authMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sub が無ければ 401', async () => {
    const { app } = buildApp()
    const res = await app.request('/probe', {}, envWithSub(undefined))
    expect(res.status).toBe(401)
  })

  it('sub はあるが users 行が無ければ 401', async () => {
    const { app, usersRepo } = buildApp()
    vi.mocked(usersRepo.findByCognitoSub).mockResolvedValue(null as never)
    const res = await app.request('/probe', {}, envWithSub('sub-unknown'))
    expect(res.status).toBe(401)
  })

  it('解決した users.id を c.set("userId") に入れて通過させる', async () => {
    const { app, usersRepo } = buildApp()
    vi.mocked(usersRepo.findByCognitoSub).mockResolvedValue({ id: 'user-1' })
    const res = await app.request('/probe', {}, envWithSub('sub-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'user-1' })
    expect(usersRepo.findByCognitoSub).toHaveBeenCalledWith('sub-1')
  })
})
