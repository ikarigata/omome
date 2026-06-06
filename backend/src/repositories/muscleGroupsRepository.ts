import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { muscleGroups } from '../db/schema.js'

export const muscleGroupsRepository = {
  async findAll() {
    return db.select().from(muscleGroups)
  },

  async findById(id: string) {
    const [row] = await db.select().from(muscleGroups).where(eq(muscleGroups.id, id))
    return row ?? null
  },
}
