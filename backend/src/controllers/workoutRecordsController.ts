import { Hono } from 'hono'
import { WorkoutRecordUpsertRequestSchema, WorkoutSetCreateRequestSchema } from '@omome/shared'
import type { WorkoutRecordsService } from '../services/workoutRecordsService.js'
import type { WorkoutSetsService } from '../services/workoutSetsService.js'
import type { HonoEnv } from '../types.js'
import { z } from 'zod'

const WorkoutRecordUpdateSchema = z.object({ notes: z.string().nullable().optional() })

export function createWorkoutRecordsController(deps: {
  workoutRecordsService: WorkoutRecordsService
  workoutSetsService: WorkoutSetsService
}) {
  const { workoutRecordsService, workoutSetsService } = deps
  const controller = new Hono<HonoEnv>()

  controller.get('/', async (c) => {
    const userId = c.get('userId')
    return c.json(await workoutRecordsService.getAll(userId))
  })

  controller.get('/:id', async (c) => {
    const userId = c.get('userId')
    return c.json(await workoutRecordsService.getById(userId, c.req.param('id')))
  })

  controller.post('/', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutRecordUpsertRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await workoutRecordsService.upsert(userId, parsed.data))
  })

  controller.put('/:id', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutRecordUpdateSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await workoutRecordsService.update(userId, c.req.param('id'), parsed.data))
  })

  controller.delete('/:id', async (c) => {
    const userId = c.get('userId')
    await workoutRecordsService.delete(userId, c.req.param('id'))
    return c.json({ success: true })
  })

  // Nested: workout-sets under a workout-record
  controller.get('/:workoutRecordId/workout-sets', async (c) => {
    const userId = c.get('userId')
    return c.json(
      await workoutSetsService.getByWorkoutRecord(userId, c.req.param('workoutRecordId')),
    )
  })

  controller.post('/:workoutRecordId/workout-sets', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutSetCreateRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(
      await workoutSetsService.create(userId, c.req.param('workoutRecordId'), parsed.data),
    )
  })

  return controller
}
