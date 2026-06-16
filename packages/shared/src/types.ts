import type { z } from 'zod'
import type {
  ExerciseResponseSchema,
  ExerciseUpsertRequestSchema,
} from './schemas/exercise.js'
import type { MuscleGroupResponseSchema } from './schemas/muscleGroup.js'
import type {
  WorkoutDayResponseSchema,
  WorkoutDayCreateRequestSchema,
  WorkoutDayUpdateRequestSchema,
} from './schemas/workoutDay.js'
import type {
  WorkoutRecordResponseSchema,
  WorkoutRecordUpsertRequestSchema,
} from './schemas/workoutRecord.js'
import type {
  WorkoutSetResponseSchema,
  WorkoutSetCreateRequestSchema,
  WorkoutSetUpdateRequestSchema,
  WorkoutSetReorderRequestSchema,
} from './schemas/workoutSet.js'
import type { UserResponseSchema, UserUpdateRequestSchema } from './schemas/user.js'
import type { CalendarResponseSchema } from './schemas/calendar.js'
import type { ExerciseProgressResponseSchema } from './schemas/exerciseProgress.js'
import type { ExerciseHistoryResponseSchema } from './schemas/exerciseHistory.js'

export type ExerciseResponse = z.infer<typeof ExerciseResponseSchema>
export type ExerciseUpsertRequest = z.infer<typeof ExerciseUpsertRequestSchema>

export type MuscleGroupResponse = z.infer<typeof MuscleGroupResponseSchema>

export type WorkoutDayResponse = z.infer<typeof WorkoutDayResponseSchema>
export type WorkoutDayCreateRequest = z.infer<typeof WorkoutDayCreateRequestSchema>
export type WorkoutDayUpdateRequest = z.infer<typeof WorkoutDayUpdateRequestSchema>

export type WorkoutRecordResponse = z.infer<typeof WorkoutRecordResponseSchema>
export type WorkoutRecordUpsertRequest = z.infer<typeof WorkoutRecordUpsertRequestSchema>

export type WorkoutSetResponse = z.infer<typeof WorkoutSetResponseSchema>
export type WorkoutSetCreateRequest = z.infer<typeof WorkoutSetCreateRequestSchema>
export type WorkoutSetUpdateRequest = z.infer<typeof WorkoutSetUpdateRequestSchema>
export type WorkoutSetReorderRequest = z.infer<typeof WorkoutSetReorderRequestSchema>

export type UserResponse = z.infer<typeof UserResponseSchema>
export type UserUpdateRequest = z.infer<typeof UserUpdateRequestSchema>

export type CalendarResponse = z.infer<typeof CalendarResponseSchema>

export type ExerciseProgressResponse = z.infer<typeof ExerciseProgressResponseSchema>

export type ExerciseHistoryResponse = z.infer<typeof ExerciseHistoryResponseSchema>
