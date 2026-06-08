import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createExercisesService } from '../exercisesService.js'
import { createMockExercisesRepository } from '../../test/mockRepositories.js'
import { AppError } from '../../middleware/error.js'

const USER = 'user-1'
const OTHER = 'user-2'

function fakeExerciseRow(overrides: Partial<{ id: string; userId: string }> = {}) {
  return {
    id: overrides.id ?? 'ex-1',
    userId: overrides.userId ?? USER,
    name: '腕立て伏せ',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    muscleGroups: [
      {
        id: 'emg-1',
        exerciseId: overrides.id ?? 'ex-1',
        muscleGroupId: 'mg-chest',
        isPrimary: false,
        muscleGroup: { id: 'mg-chest', name: '胸', createdAt: '2026-01-01T00:00:00.000Z' },
      },
      {
        id: 'emg-2',
        exerciseId: overrides.id ?? 'ex-1',
        muscleGroupId: 'mg-arm',
        isPrimary: true,
        muscleGroup: { id: 'mg-arm', name: '腕', createdAt: '2026-01-01T00:00:00.000Z' },
      },
    ],
  }
}

function setup() {
  const exercisesRepo = createMockExercisesRepository()
  const service = createExercisesService({ exercisesRepo })
  return { exercisesRepo, service }
}

describe('exercisesService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getById — 所有権チェック', () => {
    it('存在しないと 404', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(undefined as never)
      await expect(service.getById(USER, 'ex-1')).rejects.toMatchObject({ status: 404 })
    })

    it('他人の所有なら 403', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExerciseRow({ userId: OTHER }) as never)
      await expect(service.getById(USER, 'ex-1')).rejects.toMatchObject({ status: 403 })
    })

    it('自分の所有ならメインを先頭にして返す', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExerciseRow() as never)
      const res = await service.getById(USER, 'ex-1')
      expect(res.muscleGroups[0]).toMatchObject({ id: 'mg-arm', isPrimary: true })
      expect(res.muscleGroups[1]).toMatchObject({ id: 'mg-chest', isPrimary: false })
    })
  })

  describe('upsert — 冪等性', () => {
    const data = {
      id: 'ex-1',
      name: '腕立て伏せ',
      description: undefined,
      muscleGroups: [{ id: 'mg-arm', isPrimary: true }],
    }

    it('既存IDかつ自分の所有なら既存を返し、INSERT しない（冪等）', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExerciseRow() as never)
      const res = await service.upsert(USER, data as never)
      expect(res.id).toBe('ex-1')
      expect(exercisesRepo.upsert).not.toHaveBeenCalled()
    })

    it('既存IDだが他人の所有なら 403', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExerciseRow({ userId: OTHER }) as never)
      await expect(service.upsert(USER, data as never)).rejects.toMatchObject({ status: 403 })
      expect(exercisesRepo.upsert).not.toHaveBeenCalled()
    })

    it('新規なら upsert を呼び、作成行を返す', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById)
        .mockResolvedValueOnce(undefined as never) // 事前チェック: 存在しない
        .mockResolvedValueOnce(fakeExerciseRow() as never) // INSERT 後の再取得
      vi.mocked(exercisesRepo.upsert).mockResolvedValue({ id: 'ex-1' } as never)
      const res = await service.upsert(USER, data as never)
      expect(exercisesRepo.upsert).toHaveBeenCalledOnce()
      expect(res.id).toBe('ex-1')
    })

    it('INSERT 競合（upsert→null）でも既存行に合流して返す', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById)
        .mockResolvedValueOnce(undefined as never) // 事前チェック
        .mockResolvedValueOnce(fakeExerciseRow() as never) // 競合後の再取得
      vi.mocked(exercisesRepo.upsert).mockResolvedValue(null as never) // 23505 → null
      const res = await service.upsert(USER, data as never)
      expect(res.id).toBe('ex-1')
    })

    it('INSERT 競合後の行が他人の所有なら 403', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById)
        .mockResolvedValueOnce(undefined as never)
        .mockResolvedValueOnce(fakeExerciseRow({ userId: OTHER }) as never)
      vi.mocked(exercisesRepo.upsert).mockResolvedValue(null as never)
      await expect(service.upsert(USER, data as never)).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('update — 中間テーブル全置換', () => {
    it('自分の所有なら repo.update を呼ぶ', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExerciseRow() as never)
      vi.mocked(exercisesRepo.update).mockResolvedValue(undefined as never)
      await service.update(USER, 'ex-1', {
        id: 'ex-1',
        name: '更新',
        muscleGroups: [{ id: 'mg-arm', isPrimary: true }],
      } as never)
      expect(exercisesRepo.update).toHaveBeenCalledOnce()
    })

    it('他人の所有なら 403（update を呼ばない）', async () => {
      const { exercisesRepo, service } = setup()
      vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExerciseRow({ userId: OTHER }) as never)
      await expect(
        service.update(USER, 'ex-1', { id: 'ex-1', name: 'x', muscleGroups: [] } as never),
      ).rejects.toMatchObject({ status: 403 })
      expect(exercisesRepo.update).not.toHaveBeenCalled()
    })
  })

  it('throw されるのは AppError', async () => {
    const { exercisesRepo, service } = setup()
    vi.mocked(exercisesRepo.findById).mockResolvedValue(undefined as never)
    await expect(service.getById(USER, 'ex-1')).rejects.toBeInstanceOf(AppError)
  })
})
