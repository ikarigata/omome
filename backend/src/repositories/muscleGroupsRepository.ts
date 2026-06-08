import { eq } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import { muscleGroups } from '../db/schema.js'

export function createMuscleGroupsRepository(db: DB) {
  return {
    async findAll() {
      return db.select().from(muscleGroups)
    },

    async findById(id: string) {
      const [row] = await db.select().from(muscleGroups).where(eq(muscleGroups.id, id))
      return row ?? null
    },
  }
}

export type MuscleGroupsRepository = ReturnType<typeof createMuscleGroupsRepository>
