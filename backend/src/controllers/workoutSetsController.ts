import { Hono } from 'hono'
import { WorkoutSetUpdateRequestSchema } from '@omome/shared'
import type { WorkoutSetsService } from '../services/workoutSetsService.js'
import type { HonoEnv } from '../types.js'

export function createWorkoutSetsController(deps: { workoutSetsService: WorkoutSetsService }) {
  const { workoutSetsService } = deps
  const controller = new Hono<HonoEnv>()

  controller.get('/:id', async (c) => {
    const userId = c.get('userId')
    return c.json(await workoutSetsService.getById(userId, c.req.param('id')))
  })

  controller.put('/:id', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutSetUpdateRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await workoutSetsService.update(userId, c.req.param('id'), parsed.data))
  })

  controller.delete('/:id', async (c) => {
    const userId = c.get('userId')
    await workoutSetsService.delete(userId, c.req.param('id'))
    return c.json({ success: true })
  })

  return controller
}
