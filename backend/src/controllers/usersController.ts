import { Hono } from 'hono'
import { UserUpdateRequestSchema } from '@omome/shared'
import type { UsersService } from '../services/usersService.js'
import type { HonoEnv } from '../types.js'

export function createUsersController(deps: { usersService: UsersService }) {
  const { usersService } = deps
  const controller = new Hono<HonoEnv>()

  controller.get('/me', async (c) => {
    const userId = c.get('userId')
    return c.json(await usersService.getMe(userId))
  })

  controller.put('/me', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = UserUpdateRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await usersService.updateMe(userId, parsed.data))
  })

  return controller
}
