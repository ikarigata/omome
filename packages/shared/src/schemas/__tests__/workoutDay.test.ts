import { describe, it, expect } from 'vitest'
import {
  WorkoutDayCreateRequestSchema,
  WorkoutDayUpdateRequestSchema,
  WorkoutDayResponseSchema,
} from '../workoutDay.js'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('WorkoutDayCreateRequestSchema', () => {
  it('date が YYYY-MM-DD → OK', () => {
    const r = WorkoutDayCreateRequestSchema.safeParse({ id: UUID, date: '2026-06-08' })
    expect(r.success).toBe(true)
  })

  it('date が不正形式 → エラー', () => {
    for (const date of ['2026/06/08', '06-08-2026', '2026-6-8', 'abc', '']) {
      expect(WorkoutDayCreateRequestSchema.safeParse({ id: UUID, date }).success).toBe(false)
    }
  })

  it('id が UUID でない → エラー', () => {
    expect(WorkoutDayCreateRequestSchema.safeParse({ id: 'x', date: '2026-06-08' }).success).toBe(false)
  })

  it('title / notes 任意', () => {
    const r = WorkoutDayCreateRequestSchema.safeParse({
      id: UUID,
      date: '2026-06-08',
      title: '胸の日',
      notes: 'メモ',
    })
    expect(r.success).toBe(true)
  })
})

describe('WorkoutDayUpdateRequestSchema', () => {
  it('空オブジェクト OK', () => {
    expect(WorkoutDayUpdateRequestSchema.safeParse({}).success).toBe(true)
  })

  it('不正な date → エラー', () => {
    expect(WorkoutDayUpdateRequestSchema.safeParse({ date: '2026/06/08' }).success).toBe(false)
  })
})

describe('WorkoutDayResponseSchema', () => {
  it('valid なレスポンスが parse を通る', () => {
    const r = WorkoutDayResponseSchema.safeParse({
      id: UUID,
      date: '2026-06-08',
      title: null,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })
})
