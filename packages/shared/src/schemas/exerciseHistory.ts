import { z } from 'zod'

// 履歴画面の集約レスポンス。指定種目の直近セッション（= その種目を行った
// トレーニング日）を新しい順に返す。各セッションは表示順（position）に並んだ
// セットを持つ。閲覧専用で、編集系の API は持たない。
const ExerciseHistorySetSchema = z.object({
  id: z.string().uuid(),
  reps: z.number().int(),
  weight: z.number(),
})

const ExerciseHistorySessionSchema = z.object({
  workoutDayId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  sets: z.array(ExerciseHistorySetSchema),
})

export const ExerciseHistoryResponseSchema = z.object({
  exerciseId: z.string().uuid(),
  // 新しいセッションが先頭。直近 N 件（既定 5）に制限される。
  sessions: z.array(ExerciseHistorySessionSchema),
})
