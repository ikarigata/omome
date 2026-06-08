import { describe, it, expect } from 'vitest'
import {
  toDateString,
  formatDate,
  formatDateJa,
  getDayOfWeekJa,
  getDaysInMonth,
  getFirstDayOfWeek,
} from '../date'

describe('toDateString', () => {
  it('Date を YYYY-MM-DD（0埋め）に変換', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateString(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('formatDate / formatDateJa', () => {
  it('formatDate は スラッシュ区切り', () => {
    expect(formatDate('2026-06-08')).toBe('2026/06/08')
  })
  it('formatDateJa は年月日（先頭ゼロ除去）', () => {
    expect(formatDateJa('2026-06-08')).toBe('2026年6月8日')
  })
})

describe('getDayOfWeekJa', () => {
  it('曜日を日本語1文字で返す', () => {
    // 2026-06-08 は月曜
    expect(getDayOfWeekJa('2026-06-08')).toBe('月')
  })
})

describe('getDaysInMonth', () => {
  it('月の日数を返す', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28)
    expect(getDaysInMonth(2024, 2)).toBe(29) // うるう年
    expect(getDaysInMonth(2026, 6)).toBe(30)
  })
})

describe('getFirstDayOfWeek', () => {
  it('月初の曜日インデックス(0=日)を返す', () => {
    // 2026-06-01 は月曜 → 1
    expect(getFirstDayOfWeek(2026, 6)).toBe(1)
  })
})
