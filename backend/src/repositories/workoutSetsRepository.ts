import { and, asc, eq, max } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client.js'
import { workoutSets } from '../db/schema.js'
import { isUniqueViolation } from '../middleware/error.js'

export function createWorkoutSetsRepository(db: DB) {
  const repo = {
    async findByWorkoutRecord(workoutRecordId: string) {
      // 表示順は position 昇順。同値は created_at で安定させる（既存データの作成順を保つ）。
      return db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.workoutRecordId, workoutRecordId))
        .orderBy(asc(workoutSets.position), asc(workoutSets.createdAt))
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
        // 末尾に追加する。実績内の現在の最大 position + 1（無ければ 0）。
        const [agg] = await db
          .select({ max: max(workoutSets.position) })
          .from(workoutSets)
          .where(eq(workoutSets.workoutRecordId, data.workoutRecordId))
        const nextPosition = agg?.max == null ? 0 : agg.max + 1

        const [row] = await db
          .insert(workoutSets)
          .values({
            id: data.id,
            workoutRecordId: data.workoutRecordId,
            reps: data.reps,
            weight: String(data.weight),
            position: nextPosition,
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

    // ids の並びを新しい表示順とみなし、各セットの position を添字に更新する。
    // 他実績のセットを巻き込まないよう workoutRecordId でも絞る。
    // batch（単一トランザクション）で原子的に実行する。
    async reorder(workoutRecordId: string, ids: string[]) {
      const statements: BatchItem<'sqlite'>[] = ids.map((id, index) =>
        db
          .update(workoutSets)
          .set({ position: index })
          .where(and(eq(workoutSets.id, id), eq(workoutSets.workoutRecordId, workoutRecordId))),
      )
      if (statements.length > 0) {
        await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
      }
    },
  }

  return repo
}

export type WorkoutSetsRepository = ReturnType<typeof createWorkoutSetsRepository>
