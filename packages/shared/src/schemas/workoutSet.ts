import { z } from 'zod'

export const WorkoutSetResponseSchema = z.object({
  id: z.string().uuid(),
  workoutRecordId: z.string().uuid(),
  reps: z.number().int().min(0),
  subReps: z.number().int().min(0),
  weight: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const WorkoutSetCreateRequestSchema = z.object({
  id: z.string().uuid(),
  reps: z.number().int().min(0),
  subReps: z.number().int().min(0).default(0),
  weight: z.number().min(0),
})

export const WorkoutSetUpdateRequestSchema = z.object({
  reps: z.number().int().min(0).optional(),
  subReps: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
})
