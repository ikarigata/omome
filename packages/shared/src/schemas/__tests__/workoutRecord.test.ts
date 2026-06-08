import { describe, it, expect } from 'vitest'
import {
  WorkoutRecordUpsertRequestSchema,
  WorkoutRecordResponseSchema,
} from '../workoutRecord.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const UUID2 = '22222222-2222-4222-8222-222222222222'
const UUID3 = '33333333-3333-4333-8333-333333333333'

describe('WorkoutRecordUpsertRequestSchema', () => {
  it('必須フィールド揃い → OK', () => {
    const r = WorkoutRecordUpsertRequestSchema.safeParse({
      id: UUID,
      workoutDayId: UUID2,
      exerciseId: UUID3,
    })
    expect(r.success).toBe(true)
  })

  it('workoutDayId 欠落 → エラー', () => {
    const r = WorkoutRecordUpsertRequestSchema.safeParse({ id: UUID, exerciseId: UUID3 })
    expect(r.success).toBe(false)
  })

  it('id が UUID でない → エラー', () => {
    const r = WorkoutRecordUpsertRequestSchema.safeParse({
      id: 'x',
      workoutDayId: UUID2,
      exerciseId: UUID3,
    })
    expect(r.success).toBe(false)
  })
})

describe('WorkoutRecordResponseSchema', () => {
  it('valid なレスポンスが parse を通る', () => {
    const r = WorkoutRecordResponseSchema.safeParse({
      id: UUID,
      workoutDayId: UUID2,
      exerciseId: UUID3,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })
})
