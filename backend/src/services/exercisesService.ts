import type { ExercisesRepository } from '../repositories/exercisesRepository.js'
import { ForbiddenError, NotFoundError } from '../middleware/error.js'
import type {
  ExerciseProgressResponse,
  ExerciseResponse,
  ExerciseUpsertRequest,
} from '@omome/shared'

// Epley 式の推定 1RM。reps が 0 のセットは換算不能なので 0 扱い。
function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  return Math.round(weight * (1 + reps / 30))
}

type ExerciseRow = Awaited<ReturnType<ExercisesRepository['findById']>>

export function createExercisesService(deps: { exercisesRepo: ExercisesRepository }) {
  const { exercisesRepo } = deps

  function toResponse(row: NonNullable<ExerciseRow>): ExerciseResponse {
    const sorted = exercisesRepo.sortMuscleGroups(
      row.muscleGroups.map((emg) => ({ muscleGroup: emg.muscleGroup, isPrimary: emg.isPrimary })),
    )
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      muscleGroups: sorted.map((mg) => ({
        id: mg.muscleGroup.id,
        name: mg.muscleGroup.name,
        isPrimary: mg.isPrimary,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  return {
    async getAll(userId: string): Promise<ExerciseResponse[]> {
      const rows = await exercisesRepo.findAllByUser(userId)
      return rows.map((r) => toResponse(r as NonNullable<ExerciseRow>))
    },

    async getById(userId: string, id: string): Promise<ExerciseResponse> {
      const row = await exercisesRepo.findById(id)
      if (!row) throw new NotFoundError('Exercise not found')
      if (row.userId !== userId) throw new ForbiddenError()
      return toResponse(row)
    },

    async upsert(userId: string, data: ExerciseUpsertRequest): Promise<ExerciseResponse> {
      const existing = await exercisesRepo.findById(data.id)

      if (existing) {
        // PK exists — validate ownership then return existing (idempotent)
        if (existing.userId !== userId) throw new ForbiddenError()
        return toResponse(existing)
      }

      const result = await exercisesRepo.upsert(userId, {
        id: data.id,
        name: data.name,
        description: data.description,
        muscleGroups: data.muscleGroups,
      })

      if (!result) {
        // Race condition: another request inserted between our check and insert
        const row = await exercisesRepo.findById(data.id)
        if (!row) throw new Error('Unexpected state after insert conflict')
        if (row.userId !== userId) throw new ForbiddenError()
        return toResponse(row)
      }

      const row = await exercisesRepo.findById(data.id)
      return toResponse(row!)
    },

    async update(
      userId: string,
      id: string,
      data: ExerciseUpsertRequest,
    ): Promise<ExerciseResponse> {
      const existing = await exercisesRepo.findById(id)
      if (!existing) throw new NotFoundError('Exercise not found')
      if (existing.userId !== userId) throw new ForbiddenError()

      await exercisesRepo.update(id, {
        name: data.name,
        description: data.description ?? null,
        muscleGroups: data.muscleGroups,
      })

      const row = await exercisesRepo.findById(id)
      return toResponse(row!)
    },

    async delete(userId: string, id: string): Promise<void> {
      const existing = await exercisesRepo.findById(id)
      if (!existing) throw new NotFoundError('Exercise not found')
      if (existing.userId !== userId) throw new ForbiddenError()
      await exercisesRepo.delete(id)
    },

    // 統計画面用：種目の進捗を 1 セッション（= トレーニング日）単位で集約して返す。
    async getProgress(userId: string, id: string): Promise<ExerciseProgressResponse> {
      // 存在/所有権チェック（findById）と集計対象セットの取得（findSetsByExercise）は
      // ともにリクエストの id/userId のみに依存し互いに独立なので並列に取得する。
      // findSetsByExercise は userId で絞るため、非所有時も空配列が返るだけで情報は漏れない
      // （rows を使う前に existing で必ず NotFound/Forbidden を投げる）。
      const [existing, rows] = await Promise.all([
        exercisesRepo.findById(id),
        exercisesRepo.findSetsByExercise(userId, id),
      ])
      if (!existing) throw new NotFoundError('Exercise not found')
      if (existing.userId !== userId) throw new ForbiddenError()

      // 日付昇順で来る行を workoutDayId ごとに集約する。挿入順を保つため Map を使う。
      const byDay = new Map<
        string,
        { workoutDayId: string; date: string; totalVolume: number; maxWeight: number; oneRM: number }
      >()
      for (const row of rows) {
        const weight = Number(row.weight)
        const point = byDay.get(row.workoutDayId) ?? {
          workoutDayId: row.workoutDayId,
          date: row.date,
          totalVolume: 0,
          maxWeight: 0,
          oneRM: 0,
        }
        point.totalVolume += row.reps * weight
        point.maxWeight = Math.max(point.maxWeight, weight)
        point.oneRM = Math.max(point.oneRM, estimateOneRepMax(weight, row.reps))
        byDay.set(row.workoutDayId, point)
      }

      return {
        exerciseId: id,
        points: Array.from(byDay.values()).map((p) => ({
          workoutDayId: p.workoutDayId,
          date: p.date,
          totalVolume: p.totalVolume,
          maxWeight: p.maxWeight,
          estimatedOneRepMax: p.oneRM,
        })),
      }
    },
  }
}

export type ExercisesService = ReturnType<typeof createExercisesService>
