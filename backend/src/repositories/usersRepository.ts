import { eq } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import { users } from '../db/schema.js'

export function createUsersRepository(db: DB) {
  return {
    async findById(userId: string) {
      const [user] = await db.select().from(users).where(eq(users.id, userId))
      return user ?? null
    },

    async findByCognitoSub(sub: string) {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.cognitoSub, sub))
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
}

export type UsersRepository = ReturnType<typeof createUsersRepository>
