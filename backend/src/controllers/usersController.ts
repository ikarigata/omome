import { Hono } from 'hono'
import { UserUpdateRequestSchema } from '@omome/shared'
import { usersService } from '../services/usersService.js'
import type { HonoEnv } from '../types.js'

export const usersController = new Hono<HonoEnv>()

usersController.get('/me', async (c) => {
  const userId = c.get('userId')
  return c.json(await usersService.getMe(userId))
})

usersController.put('/me', async (c) => {
  const userId = c.get('userId')
  const raw = await c.req.json().catch(() => null)
  const parsed = UserUpdateRequestSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
  return c.json(await usersService.updateMe(userId, parsed.data))
})
