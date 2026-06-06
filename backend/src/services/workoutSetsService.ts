import { workoutSetsRepository } from '../repositories/workoutSetsRepository.js'
import { workoutRecordsRepository } from '../repositories/workoutRecordsRepository.js'
import { workoutDaysRepository } from '../repositories/workoutDaysRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type { WorkoutSetResponse, WorkoutSetCreateRequest, WorkoutSetUpdateRequest } from '@omome/shared'

type SetRow = Awaited<ReturnType<typeof workoutSetsRepository.findById>>

function toResponse(row: NonNullable<SetRow>): WorkoutSetResponse {
  return {
    id: row.id,
    workoutRecordId: row.workoutRecordId,
    reps: row.reps,
    subReps: row.subReps,
    weight: Number(row.weight),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function assertRecordOwnership(userId: string, workoutRecordId: string) {
  const record = await workoutRecordsRepository.findById(workoutRecordId)
  if (!record) throw new NotFoundError('Workout record not found')

  const day = await workoutDaysRepository.findById(record.workoutDayId)
  if (!day || day.userId !== userId) throw new ForbiddenError()

  return record
}

export const workoutSetsService = {
  async getByWorkoutRecord(userId: string, workoutRecordId: string): Promise<WorkoutSetResponse[]> {
    await assertRecordOwnership(userId, workoutRecordId)
    const rows = await workoutSetsRepository.findByWorkoutRecord(workoutRecordId)
    return rows.map(toResponse)
  },

  async getById(userId: string, id: string): Promise<WorkoutSetResponse> {
    const row = await workoutSetsRepository.findById(id)
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

    const { row } = await workoutSetsRepository.insert({
      id: data.id,
      workoutRecordId,
      reps: data.reps,
      subReps: data.subReps,
      weight: data.weight,
    })

    return toResponse(row)
  },

  async update(
    userId: string,
    id: string,
    data: WorkoutSetUpdateRequest,
  ): Promise<WorkoutSetResponse> {
    const row = await workoutSetsRepository.findById(id)
    if (!row) throw new NotFoundError('Workout set not found')
    await assertRecordOwnership(userId, row.workoutRecordId)

    const updated = await workoutSetsRepository.update(id, data)
    return toResponse(updated!)
  },

  async delete(userId: string, id: string): Promise<void> {
    const row = await workoutSetsRepository.findById(id)
    if (!row) throw new NotFoundError('Workout set not found')
    await assertRecordOwnership(userId, row.workoutRecordId)
    await workoutSetsRepository.delete(id)
  },
}
