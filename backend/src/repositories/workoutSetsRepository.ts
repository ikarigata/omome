import { eq } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import { workoutSets } from '../db/schema.js'
import { isUniqueViolation } from '../middleware/error.js'

export function createWorkoutSetsRepository(db: DB) {
  const repo = {
    async findByWorkoutRecord(workoutRecordId: string) {
      return db.select().from(workoutSets).where(eq(workoutSets.workoutRecordId, workoutRecordId))
    },

    async findById(id: string) {
      const [row] = await db.select().from(workoutSets).where(eq(workoutSets.id, id))
      return row ?? null
    },

    async insert(data: {
      id: string
      workoutRecordId: string
      reps: number
      weight: number
    }) {
      try {
        const [row] = await db
          .insert(workoutSets)
          .values({
            id: data.id,
            workoutRecordId: data.workoutRecordId,
            reps: data.reps,
            weight: String(data.weight),
          })
          .returning()
        return { row: row!, isNew: true }
      } catch (err) {
        if (isUniqueViolation(err)) {
          const existing = await repo.findById(data.id)
          return { row: existing!, isNew: false }
        }
        throw err
      }
    },

    async update(id: string, data: { reps?: number; weight?: number }) {
      const updateData: Record<string, unknown> = {}
      if (data.reps !== undefined) updateData.reps = data.reps
      if (data.weight !== undefined) updateData.weight = String(data.weight)

      const [row] = await db
        .update(workoutSets)
        .set(updateData)
        .where(eq(workoutSets.id, id))
        .returning()
      return row ?? null
    },

    async delete(id: string) {
      await db.delete(workoutSets).where(eq(workoutSets.id, id))
    },
  }

  return repo
}

export type WorkoutSetsRepository = ReturnType<typeof createWorkoutSetsRepository>
