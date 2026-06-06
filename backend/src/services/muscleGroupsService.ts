import { muscleGroupsRepository } from '../repositories/muscleGroupsRepository.js'
import { NotFoundError } from '../middleware/error.js'
import type { MuscleGroupResponse } from '@omome/shared'

function toResponse(
  mg: Awaited<ReturnType<typeof muscleGroupsRepository.findAll>>[number],
): MuscleGroupResponse {
  return { id: mg.id, name: mg.name, createdAt: mg.createdAt }
}

export const muscleGroupsService = {
  async getAll(): Promise<MuscleGroupResponse[]> {
    const rows = await muscleGroupsRepository.findAll()
    return rows.map(toResponse)
  },

  async getById(id: string): Promise<MuscleGroupResponse> {
    const row = await muscleGroupsRepository.findById(id)
    if (!row) throw new NotFoundError('Muscle group not found')
    return toResponse(row)
  },
}
