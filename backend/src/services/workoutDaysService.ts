import { workoutDaysRepository } from '../repositories/workoutDaysRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type {
  WorkoutDayResponse,
  WorkoutDayCreateRequest,
  WorkoutDayUpdateRequest,
  CalendarResponse,
} from '@omome/shared'

type DayRow = Awaited<ReturnType<typeof workoutDaysRepository.findById>>

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

export const workoutDaysService = {
  async getAll(userId: string): Promise<WorkoutDayResponse[]> {
    const rows = await workoutDaysRepository.findAllByUser(userId)
    return rows.map(toResponse)
  },

  async getById(userId: string, id: string): Promise<WorkoutDayResponse> {
    const row = await workoutDaysRepository.findById(id)
    if (!row) throw new NotFoundError('Workout day not found')
    if (row.userId !== userId) throw new ForbiddenError()
    return toResponse(row)
  },

  async create(userId: string, data: WorkoutDayCreateRequest): Promise<WorkoutDayResponse> {
    const { row } = await workoutDaysRepository.insert({
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
    const existing = await workoutDaysRepository.findById(id)
    if (!existing) throw new NotFoundError('Workout day not found')
    if (existing.userId !== userId) throw new ForbiddenError()

    const row = await workoutDaysRepository.update(id, data)
    return toResponse(row!)
  },

  async delete(userId: string, id: string): Promise<void> {
    const existing = await workoutDaysRepository.findById(id)
    if (!existing) throw new NotFoundError('Workout day not found')
    if (existing.userId !== userId) throw new ForbiddenError()
    await workoutDaysRepository.delete(id)
  },

  async getCalendar(userId: string, year: number, month: number): Promise<CalendarResponse> {
    const days = await workoutDaysRepository.findCalendarMonth(userId, year, month)
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
