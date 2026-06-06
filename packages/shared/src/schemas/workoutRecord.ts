import { z } from 'zod'

export const WorkoutRecordResponseSchema = z.object({
  id: z.string().uuid(),
  workoutDayId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const WorkoutRecordUpsertRequestSchema = z.object({
  id: z.string().uuid(),
  workoutDayId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  notes: z.string().optional(),
})
