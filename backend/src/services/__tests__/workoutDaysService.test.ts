import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWorkoutDaysService } from '../workoutDaysService.js'
import { createMockWorkoutDaysRepository } from '../../test/mockRepositories.js'

const USER = 'user-1'
const OTHER = 'user-2'

function fakeDay(userId = USER) {
  return {
    id: 'day-1',
    userId,
    date: '2026-06-08',
    title: '胸の日',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function setup() {
  const workoutDaysRepo = createMockWorkoutDaysRepository()
  const service = createWorkoutDaysService({ workoutDaysRepo })
  return { workoutDaysRepo, service }
}

describe('workoutDaysService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create: repo.insert の結果（合流含む）を返す', async () => {
    const { workoutDaysRepo, service } = setup()
    vi.mocked(workoutDaysRepo.insert).mockResolvedValue({ row: fakeDay(), isNew: false } as never)
    const res = await service.create(USER, {
      id: 'day-1',
      date: '2026-06-08',
      title: '胸の日',
    } as never)
    expect(res.id).toBe('day-1')
  })

  it('update: 他人の所有なら 403（update を呼ばない）', async () => {
    const { workoutDaysRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(fakeDay(OTHER) as never)
    await expect(service.update(USER, 'day-1', { title: 'x' } as never)).rejects.toMatchObject({
      status: 403,
    })
    expect(workoutDaysRepo.update).not.toHaveBeenCalled()
  })

  it('delete: 存在しないなら 404', async () => {
    const { workoutDaysRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findById).mockResolvedValue(null as never)
    await expect(service.delete(USER, 'day-1')).rejects.toMatchObject({ status: 404 })
  })

  it('getCalendar: 集約レスポンス（year/month/days）を整形する', async () => {
    const { workoutDaysRepo, service } = setup()
    vi.mocked(workoutDaysRepo.findCalendarMonth).mockResolvedValue([
      { workoutDayId: 'day-1', date: '2026-06-08', title: '胸の日', exerciseNames: ['ベンチプレス'] },
    ])
    const res = await service.getCalendar(USER, 2026, 6)
    expect(res).toMatchObject({ year: 2026, month: 6 })
    expect(res.days[0]).toMatchObject({
      workoutDayId: 'day-1',
      date: '2026-06-08',
      exerciseNames: ['ベンチプレス'],
    })
  })
})
