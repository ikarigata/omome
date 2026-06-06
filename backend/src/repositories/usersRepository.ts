import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'

export const usersRepository = {
  async findById(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    return user ?? null
  },

  async update(userId: string, data: { name: string }) {
    const [updated] = await db
      .update(users)
      .set({ name: data.name })
      .where(eq(users.id, userId))
      .returning()
    return updated ?? null
  },
}
