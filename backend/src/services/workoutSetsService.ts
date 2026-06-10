import type { WorkoutSetsRepository } from '../repositories/workoutSetsRepository.js'
import type { WorkoutRecordsRepository } from '../repositories/workoutRecordsRepository.js'
import type { WorkoutDaysRepository } from '../repositories/workoutDaysRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type {
  WorkoutSetResponse,
  WorkoutSetCreateRequest,
  WorkoutSetUpdateRequest,
} from '@omome/shared'

type SetRow = Awaited<ReturnType<WorkoutSetsRepository['findById']>>

function toResponse(row: NonNullable<SetRow>): WorkoutSetResponse {
  return {
    id: row.id,
    workoutRecordId: row.workoutRecordId,
    reps: row.reps,
    weight: Number(row.weight),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function createWorkoutSetsService(deps: {
  workoutSetsRepo: WorkoutSetsRepository
  workoutRecordsRepo: WorkoutRecordsRepository
  workoutDaysRepo: WorkoutDaysRepository
}) {
  const { workoutSetsRepo, workoutRecordsRepo, workoutDaysRepo } = deps

  async function assertRecordOwnership(userId: string, workoutRecordId: string) {
    const record = await workoutRecordsRepo.findById(workoutRecordId)
    if (!record) throw new NotFoundError('Workout record not found')

    const day = await workoutDaysRepo.findById(record.workoutDayId)
    if (!day || day.userId !== userId) throw new ForbiddenError()

    return record
  }

  return {
    async getByWorkoutRecord(
      userId: string,
      workoutRecordId: string,
    ): Promise<WorkoutSetResponse[]> {
      await assertRecordOwnership(userId, workoutRecordId)
      const rows = await workoutSetsRepo.findByWorkoutRecord(workoutRecordId)
      return rows.map(toResponse)
    },

    async getById(userId: string, id: string): Promise<WorkoutSetResponse> {
      const row = await workoutSetsRepo.findById(id)
      if (!row) throw new NotFoundError('Workout set not found')
      await assertRecordOwnership(userId, row.workoutRecordId)
      return toResponse(row)
    },

    async create(
      userId: string,
      workoutRecordId: string,
      data: WorkoutSetCreateRequest,
    ): Promise<WorkoutSetResponse> {
      await assertRecordOwnership(userId, workoutRecordId)

      const { row } = await workoutSetsRepo.insert({
        id: data.id,
        workoutRecordId,
        reps: data.reps,
        weight: data.weight,
      })

      return toResponse(row)
    },

    async update(
      userId: string,
      id: string,
      data: WorkoutSetUpdateRequest,
    ): Promise<WorkoutSetResponse> {
      const row = await workoutSetsRepo.findById(id)
      if (!row) throw new NotFoundError('Workout set not found')
      await assertRecordOwnership(userId, row.workoutRecordId)

      const updated = await workoutSetsRepo.update(id, data)
      return toResponse(updated!)
    },

    async delete(userId: string, id: string): Promise<void> {
      const row = await workoutSetsRepo.findById(id)
      if (!row) throw new NotFoundError('Workout set not found')
      await assertRecordOwnership(userId, row.workoutRecordId)
      await workoutSetsRepo.delete(id)
    },
  }
}

export type WorkoutSetsService = ReturnType<typeof createWorkoutSetsService>
