import { describe, it, expect } from 'vitest'
import {
  WorkoutSetCreateRequestSchema,
  WorkoutSetUpdateRequestSchema,
  WorkoutSetResponseSchema,
} from '../workoutSet.js'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('WorkoutSetCreateRequestSchema', () => {
  it('正常系 → OK', () => {
    const r = WorkoutSetCreateRequestSchema.safeParse({ id: UUID, reps: 10, weight: 60 })
    expect(r.success).toBe(true)
  })

  it('reps が負値 → エラー', () => {
    const r = WorkoutSetCreateRequestSchema.safeParse({ id: UUID, reps: -1, weight: 60 })
    expect(r.success).toBe(false)
  })

  it('weight が負値 → エラー', () => {
    const r = WorkoutSetCreateRequestSchema.safeParse({ id: UUID, reps: 10, weight: -1 })
    expect(r.success).toBe(false)
  })

  it('reps が小数 → エラー（int 制約）', () => {
    const r = WorkoutSetCreateRequestSchema.safeParse({ id: UUID, reps: 1.5, weight: 60 })
    expect(r.success).toBe(false)
  })

  it('id が UUID でない → エラー', () => {
    const r = WorkoutSetCreateRequestSchema.safeParse({ id: 'x', reps: 10, weight: 60 })
    expect(r.success).toBe(false)
  })

  it('weight は小数 OK', () => {
    const r = WorkoutSetCreateRequestSchema.safeParse({ id: UUID, reps: 10, weight: 62.5 })
    expect(r.success).toBe(true)
  })
})

describe('WorkoutSetUpdateRequestSchema', () => {
  it('全フィールド任意 → 空オブジェクトでも OK', () => {
    expect(WorkoutSetUpdateRequestSchema.safeParse({}).success).toBe(true)
  })

  it('負値はエラー', () => {
    expect(WorkoutSetUpdateRequestSchema.safeParse({ reps: -1 }).success).toBe(false)
  })
})

describe('WorkoutSetResponseSchema', () => {
  it('valid なレスポンスが parse を通る', () => {
    const r = WorkoutSetResponseSchema.safeParse({
      id: UUID,
      workoutRecordId: UUID,
      reps: 10,
      weight: 60,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })
})
