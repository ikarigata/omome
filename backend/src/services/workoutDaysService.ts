import type { WorkoutDaysRepository } from '../repositories/workoutDaysRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type {
  WorkoutDayResponse,
  WorkoutDayCreateRequest,
  WorkoutDayUpdateRequest,
  CalendarResponse,
} from '@omome/shared'

type DayRow = Awaited<ReturnType<WorkoutDaysRepository['findById']>>

function toResponse(row: NonNullable<DayRow>): WorkoutDayResponse {
  return {
    id: row.id,
    date: row.date,
    title: row.title ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function createWorkoutDaysService(deps: { workoutDaysRepo: WorkoutDaysRepository }) {
  const { workoutDaysRepo } = deps

  return {
    async getAll(userId: string): Promise<WorkoutDayResponse[]> {
      // 2クエリは userId のみに依存し互いに独立なので並列に取得する（直列2往復→1往復相当）。
      const [rows, mgRows] = await Promise.all([
        workoutDaysRepo.findAllByUser(userId),
        workoutDaysRepo.findPrimaryMuscleGroupsByUser(userId),
      ])

      // 日ごとにメイン部位名を集約（record 作成順を保ちつつ重複排除）。
      const byDay = new Map<string, string[]>()
      for (const { workoutDayId, muscleGroupName } of mgRows) {
        const names = byDay.get(workoutDayId) ?? []
        if (!names.includes(muscleGroupName)) names.push(muscleGroupName)
        byDay.set(workoutDayId, names)
      }

      return rows.map((row) => ({ ...toResponse(row), muscleGroups: byDay.get(row.id) ?? [] }))
    },

    async getById(userId: string, id: string): Promise<WorkoutDayResponse> {
      const row = await workoutDaysRepo.findById(id)
      if (!row) throw new NotFoundError('Workout day not found')
      if (row.userId !== userId) throw new ForbiddenError()
      return toResponse(row)
    },

    async create(userId: string, data: WorkoutDayCreateRequest): Promise<WorkoutDayResponse> {
      const { row } = await workoutDaysRepo.insert({
        id: data.id,
        userId,
        date: data.date,
        title: data.title,
        notes: data.notes,
      })

      if (row.userId !== userId) throw new ForbiddenError()
      return toResponse(row)
    },

    async update(
      userId: string,
      id: string,
      data: WorkoutDayUpdateRequest,
    ): Promise<WorkoutDayResponse> {
      const existing = await workoutDaysRepo.findById(id)
      if (!existing) throw new NotFoundError('Workout day not found')
      if (existing.userId !== userId) throw new ForbiddenError()

      const row = await workoutDaysRepo.update(id, data)
      return toResponse(row!)
    },

    async delete(userId: string, id: string): Promise<void> {
      const existing = await workoutDaysRepo.findById(id)
      if (!existing) throw new NotFoundError('Workout day not found')
      if (existing.userId !== userId) throw new ForbiddenError()
      await workoutDaysRepo.delete(id)
    },

    async getCalendar(userId: string, year: number, month: number): Promise<CalendarResponse> {
      const days = await workoutDaysRepo.findCalendarMonth(userId, year, month)
      return {
        year,
        month,
        days: days.map((d) => ({
          workoutDayId: d.workoutDayId,
          date: d.date,
          title: d.title ?? null,
          exerciseNames: d.exerciseNames,
        })),
      }
    },
  }
}

export type WorkoutDaysService = ReturnType<typeof createWorkoutDaysService>
