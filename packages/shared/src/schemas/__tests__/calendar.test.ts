import { describe, it, expect } from 'vitest'
import { CalendarResponseSchema } from '../calendar.js'

const UUID = '11111111-1111-4111-8111-111111111111'

function valid() {
  return {
    year: 2026,
    month: 6,
    days: [
      {
        workoutDayId: UUID,
        date: '2026-06-08',
        title: '胸の日',
        exerciseNames: ['ベンチプレス', 'ダンベルフライ'],
      },
    ],
  }
}

describe('CalendarResponseSchema 案A 集約レスポンス', () => {
  it('valid な集約レスポンスが parse を通る', () => {
    expect(CalendarResponseSchema.safeParse(valid()).success).toBe(true)
  })

  it('days 空配列 OK', () => {
    expect(CalendarResponseSchema.safeParse({ year: 2026, month: 6, days: [] }).success).toBe(true)
  })

  it('month 範囲外 → エラー', () => {
    expect(CalendarResponseSchema.safeParse({ ...valid(), month: 13 }).success).toBe(false)
    expect(CalendarResponseSchema.safeParse({ ...valid(), month: 0 }).success).toBe(false)
  })

  it('year 範囲外 → エラー', () => {
    expect(CalendarResponseSchema.safeParse({ ...valid(), year: 1999 }).success).toBe(false)
  })

  it('day の date が不正形式 → エラー', () => {
    const bad = valid()
    bad.days[0].date = '2026/06/08'
    expect(CalendarResponseSchema.safeParse(bad).success).toBe(false)
  })
})
