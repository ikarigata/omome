import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWorkoutRecordsService } from '../workoutRecordsService.js'
import {
  createMockWorkoutRecordsRepository,
  createMockWorkoutDaysRepository,
  createMockExercisesRepository,
} from '../../test/mockRepositories.js'

const USER = 'user-1'
const OTHER = 'user-2'

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

function fakeExercise(userId = USER) {
  return { id: 'ex-1', userId, name: 'x', description: null, muscleGroups: [] }
}

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

function setup() {
  const workoutRecordsRepo = createMockWorkoutRecordsRepository()
  const workoutDaysRepo = createMockWorkoutDaysRepository()
  const exercisesRepo = createMockExercisesRepository()
  const service = createWorkoutRecordsService({ workoutRecordsRepo, workoutDaysRepo, exercisesRepo })
  return { workoutRecordsRepo, workoutDaysRepo, exercisesRepo, service }
}

const upsertData = { id: 'rec-1', workoutDayId: 'day-1', exerciseId: 'ex-1', notes: undefined }

describe('workoutRecordsService.upsert — 親リソースの所有権', () => {
  beforeEach(() => vi.clearAllMocks())

  it('親 workout_day が存在しないと 404', async () => {
    const { workoutDaysRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(null as never)
    await expect(service.upsert(USER, upsertData as never)).rejects.toMatchObject({ status: 404 })
  })

  it('親 workout_day が他人の所有なら 403', async () => {
    const { workoutDaysRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay(OTHER) as never)
    await expect(service.upsert(USER, upsertData as never)).rejects.toMatchObject({ status: 403 })
  })

  it('exercise が他人の所有なら 403', async () => {
    const { workoutDaysRepo, exercisesRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay() as never)
    vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExercise(OTHER) as never)
    await expect(service.upsert(USER, upsertData as never)).rejects.toMatchObject({ status: 403 })
  })

  it('所有権 OK なら upsert を呼び、（PK/複合UNIQUE 重複でも）repo が返す行を返す', async () => {
    const { workoutDaysRepo, exercisesRepo, workoutRecordsRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay() as never)
    vi.mocked(exercisesRepo.findById).mockResolvedValue(fakeExercise() as never)
    // repo は 23505 を内部で吸収し、合流した既存行を isNew:false で返す
    vi.mocked(workoutRecordsRepo.upsert).mockResolvedValue({ row: fakeRecord(), isNew: false } as never)
    const res = await service.upsert(USER, upsertData as never)
    expect(workoutRecordsRepo.upsert).toHaveBeenCalledOnce()
    expect(res.id).toBe('rec-1')
  })
})

describe('workoutRecordsService.getById — workout_day 経由の所有権', () => {
  beforeEach(() => vi.clearAllMocks())

  it('record が他人の day に属するなら 403', async () => {
    const { workoutRecordsRepo, workoutDaysRepo, service } = setup()
    vi.mocked(workoutRecordsRepo.findById).mockResolvedValue(fakeRecord() as never)
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay(OTHER) as never)
    await expect(service.getById(USER, 'rec-1')).rejects.toMatchObject({ status: 403 })
  })
})
