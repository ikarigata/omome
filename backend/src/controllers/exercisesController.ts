import { Hono } from 'hono'
import { ExerciseUpsertRequestSchema } from '@omome/shared'
import type { ExercisesService } from '../services/exercisesService.js'
import type { HonoEnv } from '../types.js'

export function createExercisesController(deps: { exercisesService: ExercisesService }) {
  const { exercisesService } = deps
  const controller = new Hono<HonoEnv>()

  controller.get('/', async (c) => {
    const userId = c.get('userId')
    return c.json(await exercisesService.getAll(userId))
  })

  controller.get('/:id', async (c) => {
    const userId = c.get('userId')
    return c.json(await exercisesService.getById(userId, c.req.param('id')))
  })

  controller.post('/', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = ExerciseUpsertRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await exercisesService.upsert(userId, parsed.data))
  })

  controller.put('/:id', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = ExerciseUpsertRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await exercisesService.update(userId, c.req.param('id'), parsed.data))
  })

  controller.delete('/:id', async (c) => {
    const userId = c.get('userId')
    await exercisesService.delete(userId, c.req.param('id'))
    return c.json({ success: true })
  })

  return controller
}
