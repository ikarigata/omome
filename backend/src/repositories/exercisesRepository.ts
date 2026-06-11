import { asc, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client.js'
import { exercises, exerciseMuscleGroups, muscleGroups } from '../db/schema.js'
import { isUniqueViolation } from '../middleware/error.js'

type MuscleGroupEntry = { id: string; isPrimary: boolean }

export function createExercisesRepository(db: DB) {
  const repo = {
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
      const emgRows = data.muscleGroups.map((mg) => ({
        id: crypto.randomUUID(),
        exerciseId: data.id,
        muscleGroupId: mg.id,
        isPrimary: mg.isPrimary,
      }))

      try {
        // batch は単一トランザクションとして原子的に実行されるので、
        // 種目行 + 中間テーブル行をまとめて挿入する。
        const [inserted] = await db.batch([
          db
            .insert(exercises)
            .values({ id: data.id, userId, name: data.name, description: data.description ?? null })
            .returning(),
          db.insert(exerciseMuscleGroups).values(emgRows),
        ])
        return inserted[0]!
      } catch (err) {
        if (isUniqueViolation(err)) return null // signal existing row
        throw err
      }
    },

    async update(
      id: string,
      data: { name?: string; description?: string | null; muscleGroups?: MuscleGroupEntry[] },
    ) {
      // batch（単一トランザクション）で原子的に実行する。
      const statements: BatchItem<'sqlite'>[] = []

      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description

      if (Object.keys(updateData).length > 0) {
        statements.push(db.update(exercises).set(updateData).where(eq(exercises.id, id)))
      }

      if (data.muscleGroups !== undefined) {
        // Full replacement of muscle group associations（削除 + 再挿入）
        statements.push(
          db.delete(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, id)),
        )
        const emgRows = data.muscleGroups.map((mg) => ({
          id: crypto.randomUUID(),
          exerciseId: id,
          muscleGroupId: mg.id,
          isPrimary: mg.isPrimary,
        }))
        statements.push(db.insert(exerciseMuscleGroups).values(emgRows))
      }

      if (statements.length > 0) {
        await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
      }
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

  return repo
}

export type ExercisesRepository = ReturnType<typeof createExercisesRepository>
