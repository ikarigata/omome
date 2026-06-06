import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { workoutDays, workoutRecords, exercises } from '../db/schema.js'
import { isUniqueViolation } from '../middleware/error.js'

export const workoutDaysRepository = {
  async findAllByUser(userId: string) {
    return db
      .select()
      .from(workoutDays)
      .where(eq(workoutDays.userId, userId))
      .orderBy(desc(workoutDays.date))
  },

  async findById(id: string) {
    const [row] = await db.select().from(workoutDays).where(eq(workoutDays.id, id))
    return row ?? null
  },

  async insert(data: {
    id: string
    userId: string
    date: string
    title?: string
    notes?: string
  }) {
    try {
      const [row] = await db
        .insert(workoutDays)
        .values({
          id: data.id,
          userId: data.userId,
          date: data.date,
          title: data.title ?? null,
          notes: data.notes ?? null,
        })
        .returning()
      return { row: row!, isNew: true }
    } catch (err) {
      if (isUniqueViolation(err)) {
        const existing = await this.findById(data.id)
        return { row: existing!, isNew: false }
      }
      throw err
    }
  },

  async update(id: string, data: { date?: string; title?: string | null; notes?: string | null }) {
    const [row] = await db
      .update(workoutDays)
      .set(data)
      .where(eq(workoutDays.id, id))
      .returning()
    return row ?? null
  },

  async delete(id: string) {
    await db.delete(workoutDays).where(eq(workoutDays.id, id))
  },

  async findCalendarMonth(userId: string, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const rows = await db
      .select({
        workoutDayId: workoutDays.id,
        date: workoutDays.date,
        title: workoutDays.title,
        exerciseName: exercises.name,
      })
      .from(workoutDays)
      .leftJoin(workoutRecords, eq(workoutRecords.workoutDayId, workoutDays.id))
      .leftJoin(exercises, eq(exercises.id, workoutRecords.exerciseId))
      .where(
        and(
          eq(workoutDays.userId, userId),
          gte(workoutDays.date, startDate),
          lt(workoutDays.date, endDate),
        ),
      )
      .orderBy(workoutDays.date, workoutRecords.createdAt)

    // Aggregate exercise names per day
    const dayMap = new Map<
      string,
      { workoutDayId: string; date: string; title: string | null; exerciseNames: string[] }
    >()
    for (const row of rows) {
      if (!dayMap.has(row.workoutDayId)) {
        dayMap.set(row.workoutDayId, {
          workoutDayId: row.workoutDayId,
          date: row.date,
          title: row.title,
          exerciseNames: [],
        })
      }
      if (row.exerciseName) {
        dayMap.get(row.workoutDayId)!.exerciseNames.push(row.exerciseName)
      }
    }

    return Array.from(dayMap.values())
  },
}
