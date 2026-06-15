import type { WorkoutRecordsRepository } from '../repositories/workoutRecordsRepository.js'
import type { WorkoutDaysRepository } from '../repositories/workoutDaysRepository.js'
import type { ExercisesRepository } from '../repositories/exercisesRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type { WorkoutRecordResponse, WorkoutRecordUpsertRequest } from '@omome/shared'

type RecordRow = Awaited<ReturnType<WorkoutRecordsRepository['findById']>>

function toResponse(row: NonNullable<RecordRow>): WorkoutRecordResponse {
  return {
    id: row.id,
    workoutDayId: row.workoutDayId,
    exerciseId: row.exerciseId,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function createWorkoutRecordsService(deps: {
  workoutRecordsRepo: WorkoutRecordsRepository
  workoutDaysRepo: WorkoutDaysRepository
  exercisesRepo: ExercisesRepository
}) {
  const { workoutRecordsRepo, workoutDaysRepo, exercisesRepo } = deps

  return {
    async getAll(userId: string): Promise<WorkoutRecordResponse[]> {
      // DB 側で workout_days を JOIN して所有者で絞る（全件取得→アプリ側 filter をやめ、1往復に）
      const rows = await workoutRecordsRepo.findAllByUser(userId)
      return rows.map(toResponse)
    },

    async getByWorkoutDay(userId: string, workoutDayId: string): Promise<WorkoutRecordResponse[]> {
      const day = await workoutDaysRepo.findById(workoutDayId)
      if (!day) throw new NotFoundError('Workout day not found')
      if (day.userId !== userId) throw new ForbiddenError()

      const rows = await workoutRecordsRepo.findByWorkoutDay(workoutDayId)
      return rows.map(toResponse)
    },

    async getById(userId: string, id: string): Promise<WorkoutRecordResponse> {
      const row = await workoutRecordsRepo.findById(id)
      if (!row) throw new NotFoundError('Workout record not found')

      // Ownership check via workout_day
      const day = await workoutDaysRepo.findById(row.workoutDayId)
      if (!day || day.userId !== userId) throw new ForbiddenError()

      return toResponse(row)
    },

    async upsert(userId: string, data: WorkoutRecordUpsertRequest): Promise<WorkoutRecordResponse> {
      // Ownership check: verify parent workout_day and exercise belong to user.
      // 両者はリクエストの id のみに依存し互いに独立なので並列に取得する（直列2往復→1往復相当）。
      const [day, exercise] = await Promise.all([
        workoutDaysRepo.findById(data.workoutDayId),
        exercisesRepo.findById(data.exerciseId),
      ])
      if (!day) throw new NotFoundError('Workout day not found')
      if (day.userId !== userId) throw new ForbiddenError()
      if (!exercise) throw new NotFoundError('Exercise not found')
      if (exercise.userId !== userId) throw new ForbiddenError()

      const { row } = await workoutRecordsRepo.upsert({
        id: data.id,
        workoutDayId: data.workoutDayId,
        exerciseId: data.exerciseId,
        notes: data.notes,
      })

      return toResponse(row)
    },

    async update(
      userId: string,
      id: string,
      data: { notes?: string | null },
    ): Promise<WorkoutRecordResponse> {
      const row = await workoutRecordsRepo.findById(id)
      if (!row) throw new NotFoundError('Workout record not found')

      const day = await workoutDaysRepo.findById(row.workoutDayId)
      if (!day || day.userId !== userId) throw new ForbiddenError()

      const updated = await workoutRecordsRepo.update(id, data)
      return toResponse(updated!)
    },

    async delete(userId: string, id: string): Promise<void> {
      const row = await workoutRecordsRepo.findById(id)
      if (!row) throw new NotFoundError('Workout record not found')

      const day = await workoutDaysRepo.findById(row.workoutDayId)
      if (!day || day.userId !== userId) throw new ForbiddenError()

      await workoutRecordsRepo.delete(id)
    },
  }
}

export type WorkoutRecordsService = ReturnType<typeof createWorkoutRecordsService>
