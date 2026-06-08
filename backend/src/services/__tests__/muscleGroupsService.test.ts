import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMuscleGroupsService } from '../muscleGroupsService.js'
import { createMockMuscleGroupsRepository } from '../../test/mockRepositories.js'

function setup() {
  const muscleGroupsRepo = createMockMuscleGroupsRepository()
  const service = createMuscleGroupsService({ muscleGroupsRepo })
  return { muscleGroupsRepo, service }
}

describe('muscleGroupsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll: マスタ一覧を整形して返す', async () => {
    const { muscleGroupsRepo, service } = setup()
    vi.mocked(muscleGroupsRepo.findAll).mockResolvedValue([
      { id: 'mg-chest', name: '胸', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    const res = await service.getAll()
    expect(res).toEqual([{ id: 'mg-chest', name: '胸', createdAt: '2026-01-01T00:00:00.000Z' }])
  })

  it('getById: 存在しないなら 404', async () => {
    const { muscleGroupsRepo, service } = setup()
    vi.mocked(muscleGroupsRepo.findById).mockResolvedValue(null as never)
    await expect(service.getById('nope')).rejects.toMatchObject({ status: 404 })
  })
})
