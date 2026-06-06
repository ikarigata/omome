import { Hono } from 'hono'
import { WorkoutRecordUpsertRequestSchema, WorkoutSetCreateRequestSchema } from '@omome/shared'
import { workoutRecordsService } from '../services/workoutRecordsService.js'
import { workoutSetsService } from '../services/workoutSetsService.js'
import type { HonoEnv } from '../types.js'
import { z } from 'zod'

const WorkoutRecordUpdateSchema = z.object({ notes: z.string().nullable().optional() })

export const workoutRecordsController = new Hono<HonoEnv>()

workoutRecordsController.get('/', async (c) => {
  const userId = c.get('userId')
  return c.json(await workoutRecordsService.getAll(userId))
})

workoutRecordsController.get('/:id', async (c) => {
  const userId = c.get('userId')
  return c.json(await workoutRecordsService.getById(userId, c.req.param('id')))
})

workoutRecordsController.post('/', async (c) => {
  const userId = c.get('userId')
  const raw = await c.req.json().catch(() => null)
  const parsed = WorkoutRecordUpsertRequestSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
  return c.json(await workoutRecordsService.upsert(userId, parsed.data))
})

workoutRecordsController.put('/:id', async (c) => {
  const userId = c.get('userId')
  const raw = await c.req.json().catch(() => null)
  const parsed = WorkoutRecordUpdateSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
  return c.json(await workoutRecordsService.update(userId, c.req.param('id'), parsed.data))
})

workoutRecordsController.delete('/:id', async (c) => {
  const userId = c.get('userId')
  await workoutRecordsService.delete(userId, c.req.param('id'))
  return c.json({ success: true })
})

// Nested: workout-sets under a workout-record
workoutRecordsController.get('/:workoutRecordId/workout-sets', async (c) => {
  const userId = c.get('userId')
  return c.json(
    await workoutSetsService.getByWorkoutRecord(userId, c.req.param('workoutRecordId')),
  )
})

workoutRecordsController.post('/:workoutRecordId/workout-sets', async (c) => {
  const userId = c.get('userId')
  const raw = await c.req.json().catch(() => null)
  const parsed = WorkoutSetCreateRequestSchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
  return c.json(
    await workoutSetsService.create(userId, c.req.param('workoutRecordId'), parsed.data),
  )
})
