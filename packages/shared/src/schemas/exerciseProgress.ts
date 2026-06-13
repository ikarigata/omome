import { z } from 'zod'

// 統計画面の集約レスポンス（カレンダーと同じ「月/種目単位の集約」方針）。
// 1セッション = その種目を行った 1 トレーニング日。日付の昇順で並ぶ。
// totalVolume / maxWeight / estimatedOneRepMax はサーバ側で都度算出する派生値で、
// DB には保存しない（volume = reps * weight を保存しない方針に従う）。
const ExerciseProgressPointSchema = z.object({
  workoutDayId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  // Σ(reps * weight)
  totalVolume: z.number(),
  // そのセッションで挙げた最大重量
  maxWeight: z.number(),
  // Epley 推定 1RM（weight * (1 + reps / 30)）の最大値
  estimatedOneRepMax: z.number(),
})

export const ExerciseProgressResponseSchema = z.object({
  exerciseId: z.string().uuid(),
  points: z.array(ExerciseProgressPointSchema),
})
