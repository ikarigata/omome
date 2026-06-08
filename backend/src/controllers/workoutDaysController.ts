import { Hono } from 'hono'
import {
  WorkoutDayCreateRequestSchema,
  WorkoutDayUpdateRequestSchema,
  WorkoutRecordUpsertRequestSchema,
} from '@omome/shared'
import type { WorkoutDaysService } from '../services/workoutDaysService.js'
import type { WorkoutRecordsService } from '../services/workoutRecordsService.js'
import { BadRequestError } from '../middleware/error.js'
import type { HonoEnv } from '../types.js'

export function createWorkoutDaysController(deps: {
  workoutDaysService: WorkoutDaysService
  workoutRecordsService: WorkoutRecordsService
}) {
  const { workoutDaysService, workoutRecordsService } = deps
  const controller = new Hono<HonoEnv>()

  // /calendar must be registered before /:id to avoid path conflict
  controller.get('/calendar', async (c) => {
    const userId = c.get('userId')
    const yearStr = c.req.query('year')
    const monthStr = c.req.query('month')
    const year = Number(yearStr)
    const month = Number(monthStr)

    if (
      !yearStr ||
      !monthStr ||
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestError('year and month (1–12) are required')
    }

    return c.json(await workoutDaysService.getCalendar(userId, year, month))
  })

  controller.get('/', async (c) => {
    const userId = c.get('userId')
    return c.json(await workoutDaysService.getAll(userId))
  })

  controller.get('/:id', async (c) => {
    const userId = c.get('userId')
    return c.json(await workoutDaysService.getById(userId, c.req.param('id')))
  })

  controller.post('/', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutDayCreateRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await workoutDaysService.create(userId, parsed.data))
  })

  controller.put('/:id', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutDayUpdateRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await workoutDaysService.update(userId, c.req.param('id'), parsed.data))
  })

  controller.delete('/:id', async (c) => {
    const userId = c.get('userId')
    await workoutDaysService.delete(userId, c.req.param('id'))
    return c.json({ success: true })
  })

  // Nested: workout-records under a workout-day
  controller.get('/:workoutDayId/workout-records', async (c) => {
    const userId = c.get('userId')
    return c.json(await workoutRecordsService.getByWorkoutDay(userId, c.req.param('workoutDayId')))
  })

  controller.post('/:workoutDayId/workout-records', async (c) => {
    const userId = c.get('userId')
    const raw = await c.req.json().catch(() => null)
    const parsed = WorkoutRecordUpsertRequestSchema.safeParse(raw)
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    return c.json(await workoutRecordsService.upsert(userId, parsed.data))
  })

  return controller
}
