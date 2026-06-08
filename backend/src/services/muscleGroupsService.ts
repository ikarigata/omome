import type { MuscleGroupsRepository } from '../repositories/muscleGroupsRepository.js'
import { NotFoundError } from '../middleware/error.js'
import type { MuscleGroupResponse } from '@omome/shared'

type MuscleGroupRow = Awaited<ReturnType<MuscleGroupsRepository['findAll']>>[number]

function toResponse(mg: MuscleGroupRow): MuscleGroupResponse {
  return { id: mg.id, name: mg.name, createdAt: mg.createdAt }
}

export function createMuscleGroupsService(deps: { muscleGroupsRepo: MuscleGroupsRepository }) {
  const { muscleGroupsRepo } = deps

  return {
    async getAll(): Promise<MuscleGroupResponse[]> {
      const rows = await muscleGroupsRepo.findAll()
      return rows.map(toResponse)
    },

    async getById(id: string): Promise<MuscleGroupResponse> {
      const row = await muscleGroupsRepo.findById(id)
      if (!row) throw new NotFoundError('Muscle group not found')
      return toResponse(row)
    },
  }
}

export type MuscleGroupsService = ReturnType<typeof createMuscleGroupsService>
