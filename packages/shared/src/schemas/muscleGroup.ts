import { z } from 'zod'

export const MuscleGroupResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
})
