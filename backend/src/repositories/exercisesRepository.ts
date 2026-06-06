import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { exercises, exerciseMuscleGroups, muscleGroups } from '../db/schema.js'
import { isUniqueViolation } from '../middleware/error.js'

type MuscleGroupEntry = { id: string; isPrimary: boolean }

export const exercisesRepository = {
  async findAllByUser(userId: string) {
    return db.query.exercises.findMany({
      where: eq(exercises.userId, userId),
      with: {
        muscleGroups: {
          with: { muscleGroup: true },
          orderBy: [asc(exerciseMuscleGroups.isPrimary)],
        },
      },
    })
  },

  async findById(id: string) {
    return db.query.exercises.findFirst({
      where: eq(exercises.id, id),
      with: {
        muscleGroups: {
          with: { muscleGroup: true },
          orderBy: [asc(exerciseMuscleGroups.isPrimary)],
        },
      },
    })
  },

  async upsert(
    userId: string,
    data: { id: string; name: string; description?: string; muscleGroups: MuscleGroupEntry[] },
  ) {
    try {
      return await db.transaction(async (tx) => {
        const [exercise] = await tx
          .insert(exercises)
          .values({ id: data.id, userId, name: data.name, description: data.description ?? null })
          .returning()

        const emgRows = data.muscleGroups.map((mg) => ({
          id: crypto.randomUUID(),
          exerciseId: data.id,
          muscleGroupId: mg.id,
          isPrimary: mg.isPrimary,
        }))
        await tx.insert(exerciseMuscleGroups).values(emgRows)

        return exercise!
      })
    } catch (err) {
      if (isUniqueViolation(err)) return null // signal existing row
      throw err
    }
  },

  async update(
    id: string,
    data: { name?: string; description?: string | null; muscleGroups?: MuscleGroupEntry[] },
  ) {
    return db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description

      if (Object.keys(updateData).length > 0) {
        await tx.update(exercises).set(updateData).where(eq(exercises.id, id))
      }

      if (data.muscleGroups !== undefined) {
        // Full replacement of muscle group associations
        await tx.delete(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, id))
        const emgRows = data.muscleGroups.map((mg) => ({
          id: crypto.randomUUID(),
          exerciseId: id,
          muscleGroupId: mg.id,
          isPrimary: mg.isPrimary,
        }))
        await tx.insert(exerciseMuscleGroups).values(emgRows)
      }
    })
  },

  async delete(id: string) {
    await db.delete(exercises).where(eq(exercises.id, id))
  },

  // Returns muscle groups as sorted array (primary first)
  sortMuscleGroups(
    mgs: Array<{ muscleGroup: typeof muscleGroups.$inferSelect; isPrimary: boolean }>,
  ) {
    return [...mgs].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
  },
}
