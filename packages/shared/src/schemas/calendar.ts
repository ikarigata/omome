import { z } from 'zod'

const CalendarDaySchema = z.object({
  workoutDayId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  title: z.string().nullable().optional(),
  exerciseNames: z.array(z.string()),
})

export const CalendarResponseSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  days: z.array(CalendarDaySchema),
})
