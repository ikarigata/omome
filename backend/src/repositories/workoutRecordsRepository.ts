import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { workoutRecords } from '../db/schema.js'
import { isUniqueViolation } from '../middleware/error.js'

export const workoutRecordsRepository = {
  async findAll() {
    return db.select().from(workoutRecords)
  },

  async findByWorkoutDay(workoutDayId: string) {
    return db.select().from(workoutRecords).where(eq(workoutRecords.workoutDayId, workoutDayId))
  },

  async findById(id: string) {
    const [row] = await db.select().from(workoutRecords).where(eq(workoutRecords.id, id))
    return row ?? null
  },

  async findByDayAndExercise(workoutDayId: string, exerciseId: string) {
    const [row] = await db
      .select()
      .from(workoutRecords)
      .where(
        and(
          eq(workoutRecords.workoutDayId, workoutDayId),
          eq(workoutRecords.exerciseId, exerciseId),
        ),
      )
    return row ?? null
  },

  async upsert(data: {
    id: string
    workoutDayId: string
    exerciseId: string
    notes?: string
  }) {
    try {
      const [row] = await db
        .insert(workoutRecords)
        .values({
          id: data.id,
          workoutDayId: data.workoutDayId,
          exerciseId: data.exerciseId,
          notes: data.notes ?? null,
        })
        .returning()
      return { row: row!, isNew: true }
    } catch (err) {
      if (isUniqueViolation(err)) {
        // PK duplicate (same id) or UNIQUE(workout_day_id, exercise_id) duplicate → merge
        const existing =
          (await this.findById(data.id)) ??
          (await this.findByDayAndExercise(data.workoutDayId, data.exerciseId))
        return { row: existing!, isNew: false }
      }
      throw err
    }
  },

  async update(id: string, data: { notes?: string | null }) {
    const [row] = await db
      .update(workoutRecords)
      .set(data)
      .where(eq(workoutRecords.id, id))
      .returning()
    return row ?? null
  },

  async delete(id: string) {
    await db.delete(workoutRecords).where(eq(workoutRecords.id, id))
  },
}
