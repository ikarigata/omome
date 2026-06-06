import { z } from 'zod'

const MuscleGroupInExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isPrimary: z.boolean(),
})

export const ExerciseResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  muscleGroups: z.array(MuscleGroupInExerciseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const MuscleGroupInExerciseRequestSchema = z.object({
  id: z.string().uuid(),
  isPrimary: z.boolean(),
})

export const ExerciseUpsertRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  muscleGroups: z
    .array(MuscleGroupInExerciseRequestSchema)
    .min(1, 'At least one muscle group is required')
    .superRefine((groups, ctx) => {
      const primaryCount = groups.filter((g) => g.isPrimary).length
      if (primaryCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Exactly one primary muscle group is required',
        })
      }
      const ids = groups.map((g) => g.id)
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate muscle group IDs are not allowed',
        })
      }
    }),
})
