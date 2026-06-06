import { Hono } from 'hono'
import { WorkoutSetUpdateRequestSchema } from '@omome/shared'
import { workoutSetsService } from '../services/workoutSetsService.js'
import type { HonoEnv } from '../types.js'

export const workoutSetsController = new Hono<HonoEnv>()

workoutSetsController.get('/:id', async (c) => {
  const userId = c.get('userId')
  return c.json(await workoutSetsService.getById(userId, c.req.param('id')))
})

workoutSetsController.put('/:id', async (c) => {
  const userId = c.get('userId')
  const raw = await c.req.json().catch(() => null)
  const parsed = WorkoutSetUpdateRequestSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
  return c.json(await workoutSetsService.update(userId, c.req.param('id'), parsed.data))
})

workoutSetsController.delete('/:id', async (c) => {
  const userId = c.get('userId')
  await workoutSetsService.delete(userId, c.req.param('id'))
  return c.json({ success: true })
})
