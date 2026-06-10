import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWorkoutSetsService } from '../workoutSetsService.js'
import {
  createMockWorkoutSetsRepository,
  createMockWorkoutRecordsRepository,
  createMockWorkoutDaysRepository,
} from '../../test/mockRepositories.js'

const USER = 'user-1'
const OTHER = 'user-2'

function fakeRecord() {
  return {
    id: 'rec-1',
    workoutDayId: 'day-1',
    exerciseId: 'ex-1',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function fakeDay(userId = USER) {
  return {
    id: 'day-1',
    userId,
    date: '2026-06-08',
    title: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function fakeSet() {
  return {
    id: 'set-1',
    workoutRecordId: 'rec-1',
    reps: 10,
    weight: '60',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function setup() {
  const workoutSetsRepo = createMockWorkoutSetsRepository()
  const workoutRecordsRepo = createMockWorkoutRecordsRepository()
  const workoutDaysRepo = createMockWorkoutDaysRepository()
  const service = createWorkoutSetsService({ workoutSetsRepo, workoutRecordsRepo, workoutDaysRepo })
  return { workoutSetsRepo, workoutRecordsRepo, workoutDaysRepo, service }
}

const createData = { id: 'set-1', reps: 10, weight: 60 }

describe('workoutSetsService — record→day→user の所有権', () => {
  beforeEach(() => vi.clearAllMocks())

  it('親 record が存在しないと 404（create を行わない）', async () => {
    const { workoutRecordsRepo, workoutSetsRepo, service } = setup()
    vi.mocked(workoutRecordsRepo.findById).mockResolvedValue(null as never)
    await expect(service.create(USER, 'rec-1', createData as never)).rejects.toMatchObject({
      status: 404,
    })
    expect(workoutSetsRepo.insert).not.toHaveBeenCalled()
  })

  it('親 record の day が他人の所有なら 403', async () => {
    const { workoutRecordsRepo, workoutDaysRepo, workoutSetsRepo, service } = setup()
    vi.mocked(workoutRecordsRepo.findById).mockResolvedValue(fakeRecord() as never)
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay(OTHER) as never)
    await expect(service.create(USER, 'rec-1', createData as never)).rejects.toMatchObject({
      status: 403,
    })
    expect(workoutSetsRepo.insert).not.toHaveBeenCalled()
  })

  it('所有権 OK なら insert し、weight を数値化して返す', async () => {
    const { workoutRecordsRepo, workoutDaysRepo, workoutSetsRepo, service } = setup()
    vi.mocked(workoutRecordsRepo.findById).mockResolvedValue(fakeRecord() as never)
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay() as never)
    vi.mocked(workoutSetsRepo.insert).mockResolvedValue({ row: fakeSet(), isNew: true } as never)
    const res = await service.create(USER, 'rec-1', createData as never)
    expect(workoutSetsRepo.insert).toHaveBeenCalledOnce()
    expect(res.weight).toBe(60)
    expect(typeof res.weight).toBe('number')
  })
})
