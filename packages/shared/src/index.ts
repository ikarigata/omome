export { ExerciseResponseSchema, ExerciseUpsertRequestSchema } from './schemas/exercise.js'
export { MuscleGroupResponseSchema } from './schemas/muscleGroup.js'
export {
  WorkoutDayResponseSchema,
  WorkoutDayCreateRequestSchema,
  WorkoutDayUpdateRequestSchema,
} from './schemas/workoutDay.js'
export {
  WorkoutRecordResponseSchema,
  WorkoutRecordUpsertRequestSchema,
} from './schemas/workoutRecord.js'
export {
  WorkoutSetResponseSchema,
  WorkoutSetCreateRequestSchema,
  WorkoutSetUpdateRequestSchema,
  WorkoutSetReorderRequestSchema,
} from './schemas/workoutSet.js'
export { UserResponseSchema, UserUpdateRequestSchema } from './schemas/user.js'
export { CalendarResponseSchema } from './schemas/calendar.js'
export { ExerciseProgressResponseSchema } from './schemas/exerciseProgress.js'
export { ExerciseHistoryResponseSchema } from './schemas/exerciseHistory.js'

export type {
  ExerciseResponse,
  ExerciseUpsertRequest,
  MuscleGroupResponse,
  WorkoutDayResponse,
  WorkoutDayCreateRequest,
  WorkoutDayUpdateRequest,
  WorkoutRecordResponse,
  WorkoutRecordUpsertRequest,
  WorkoutSetResponse,
  WorkoutSetCreateRequest,
  WorkoutSetUpdateRequest,
  WorkoutSetReorderRequest,
  UserResponse,
  UserUpdateRequest,
  CalendarResponse,
  ExerciseProgressResponse,
  ExerciseHistoryResponse,
} from './types.js'
