import { z } from 'zod'

export const WorkoutSetResponseSchema = z.object({
  id: z.string().uuid(),
  workoutRecordId: z.string().uuid(),
  reps: z.number().int().min(0),
  weight: z.number().min(0),
  // 実績内の表示順。配列はこの昇順で返る。
  position: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const WorkoutSetCreateRequestSchema = z.object({
  id: z.string().uuid(),
  reps: z.number().int().min(0),
  weight: z.number().min(0),
})

export const WorkoutSetUpdateRequestSchema = z.object({
  reps: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
})

// 実績配下のセットを並べ替える。ids は新しい表示順での全セット ID 列。
// 各 ID の position をその添字に更新する。
export const WorkoutSetReorderRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})
