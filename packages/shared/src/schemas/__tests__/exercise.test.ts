import { describe, it, expect } from 'vitest'
import { ExerciseUpsertRequestSchema, ExerciseResponseSchema } from '../exercise.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const UUID2 = '22222222-2222-4222-8222-222222222222'
const UUID3 = '33333333-3333-4333-8333-333333333333'

function base(muscleGroups: Array<{ id: string; isPrimary: boolean }>) {
  return { id: UUID, name: 'ベンチプレス', muscleGroups }
}

describe('ExerciseUpsertRequestSchema 部位配列の制約', () => {
  it('メインちょうど1件 → OK', () => {
    const r = ExerciseUpsertRequestSchema.safeParse(
      base([
        { id: UUID2, isPrimary: true },
        { id: UUID3, isPrimary: false },
      ]),
    )
    expect(r.success).toBe(true)
  })

  it('メイン0件 → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse(
      base([
        { id: UUID2, isPrimary: false },
        { id: UUID3, isPrimary: false },
      ]),
    )
    expect(r.success).toBe(false)
  })

  it('メイン2件以上 → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse(
      base([
        { id: UUID2, isPrimary: true },
        { id: UUID3, isPrimary: true },
      ]),
    )
    expect(r.success).toBe(false)
  })

  it('同一部位の重複 → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse(
      base([
        { id: UUID2, isPrimary: true },
        { id: UUID2, isPrimary: false },
      ]),
    )
    expect(r.success).toBe(false)
  })

  it('空配列 → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse(base([]))
    expect(r.success).toBe(false)
  })

  it('部位 id が UUID でない → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse(base([{ id: 'not-a-uuid', isPrimary: true }]))
    expect(r.success).toBe(false)
  })

  it('exercise id が UUID でない → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse({
      ...base([{ id: UUID2, isPrimary: true }]),
      id: 'not-a-uuid',
    })
    expect(r.success).toBe(false)
  })

  it('name が空 → エラー', () => {
    const r = ExerciseUpsertRequestSchema.safeParse({
      ...base([{ id: UUID2, isPrimary: true }]),
      name: '',
    })
    expect(r.success).toBe(false)
  })
})

describe('ExerciseResponseSchema', () => {
  it('valid なレスポンスが parse を通る', () => {
    const r = ExerciseResponseSchema.safeParse({
      id: UUID,
      name: 'ベンチプレス',
      description: null,
      muscleGroups: [{ id: UUID2, name: '胸', isPrimary: true }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })
})
