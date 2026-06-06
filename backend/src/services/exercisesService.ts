import { exercisesRepository } from '../repositories/exercisesRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type { ExerciseResponse, ExerciseUpsertRequest } from '@omome/shared'

type ExerciseRow = Awaited<ReturnType<typeof exercisesRepository.findById>>

function toResponse(row: NonNullable<ExerciseRow>): ExerciseResponse {
  const sorted = exercisesRepository.sortMuscleGroups(
    row.muscleGroups.map((emg) => ({ muscleGroup: emg.muscleGroup, isPrimary: emg.isPrimary })),
  )
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    muscleGroups: sorted.map((mg) => ({
      id: mg.muscleGroup.id,
      name: mg.muscleGroup.name,
      isPrimary: mg.isPrimary,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const exercisesService = {
  async getAll(userId: string): Promise<ExerciseResponse[]> {
    const rows = await exercisesRepository.findAllByUser(userId)
    return rows.map((r) => toResponse(r as NonNullable<ExerciseRow>))
  },

  async getById(userId: string, id: string): Promise<ExerciseResponse> {
    const row = await exercisesRepository.findById(id)
    if (!row) throw new NotFoundError('Exercise not found')
    if (row.userId !== userId) throw new ForbiddenError()
    return toResponse(row)
  },

  async upsert(userId: string, data: ExerciseUpsertRequest): Promise<ExerciseResponse> {
    const existing = await exercisesRepository.findById(data.id)

    if (existing) {
      // PK exists — validate ownership then return existing (idempotent)
      if (existing.userId !== userId) throw new ForbiddenError()
      return toResponse(existing)
    }

    const result = await exercisesRepository.upsert(userId, {
      id: data.id,
      name: data.name,
      description: data.description,
      muscleGroups: data.muscleGroups,
    })

    if (!result) {
      // Race condition: another request inserted between our check and insert
      const row = await exercisesRepository.findById(data.id)
      if (!row) throw new Error('Unexpected state after insert conflict')
      if (row.userId !== userId) throw new ForbiddenError()
      return toResponse(row)
    }

    const row = await exercisesRepository.findById(data.id)
    return toResponse(row!)
  },

  async update(userId: string, id: string, data: ExerciseUpsertRequest): Promise<ExerciseResponse> {
    const existing = await exercisesRepository.findById(id)
    if (!existing) throw new NotFoundError('Exercise not found')
    if (existing.userId !== userId) throw new ForbiddenError()

    await exercisesRepository.update(id, {
      name: data.name,
      description: data.description ?? null,
      muscleGroups: data.muscleGroups,
    })

    const row = await exercisesRepository.findById(id)
    return toResponse(row!)
  },

  async delete(userId: string, id: string): Promise<void> {
    const existing = await exercisesRepository.findById(id)
    if (!existing) throw new NotFoundError('Exercise not found')
    if (existing.userId !== userId) throw new ForbiddenError()
    await exercisesRepository.delete(id)
  },
}
