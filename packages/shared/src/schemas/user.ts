import { z } from 'zod'

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const UserUpdateRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})
