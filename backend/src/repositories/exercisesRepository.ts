import { and, asc, desc, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client.js'
import {
  exercises,
  exerciseMuscleGroups,
  muscleGroups,
  workoutDays,
  workoutRecords,
  workoutSets,
} from '../db/schema.js'
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

    // 統計用：指定種目の全セット（reps / weight）を、属するトレーニング日と
    // ともに日付昇順で返す。日ごとの集約はサービス側で行う。
    // ownership は workout_days.user_id で担保する（種目自体の所有権は
    // 呼び出し側が別途検証する）。weight は TEXT 格納なので呼び出し側で Number 化する。
    async findSetsByExercise(userId: string, exerciseId: string) {
      return db
        .select({
          workoutDayId: workoutDays.id,
          date: workoutDays.date,
          reps: workoutSets.reps,
          weight: workoutSets.weight,
        })
        .from(workoutSets)
        .innerJoin(workoutRecords, eq(workoutRecords.id, workoutSets.workoutRecordId))
        .innerJoin(workoutDays, eq(workoutDays.id, workoutRecords.workoutDayId))
        .where(and(eq(workoutRecords.exerciseId, exerciseId), eq(workoutDays.userId, userId)))
        .orderBy(asc(workoutDays.date))
    },

    // 履歴用：指定種目の全セットを、属するトレーニング日（日付の降順 = 新しい順）と
    // セットの表示順（position 昇順）で返す。日ごとのグルーピングと直近 N 件への
    // 絞り込みはサービス側で行う。ownership は workout_days.user_id で担保する。
    // weight は TEXT 格納なので呼び出し側で Number 化する。
    async findHistoryByExercise(userId: string, exerciseId: string) {
      return db
        .select({
          workoutDayId: workoutDays.id,
          date: workoutDays.date,
          setId: workoutSets.id,
          reps: workoutSets.reps,
          weight: workoutSets.weight,
        })
        .from(workoutSets)
        .innerJoin(workoutRecords, eq(workoutRecords.id, workoutSets.workoutRecordId))
        .innerJoin(workoutDays, eq(workoutDays.id, workoutRecords.workoutDayId))
        .where(and(eq(workoutRecords.exerciseId, exerciseId), eq(workoutDays.userId, userId)))
        .orderBy(desc(workoutDays.date), asc(workoutSets.position))
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
