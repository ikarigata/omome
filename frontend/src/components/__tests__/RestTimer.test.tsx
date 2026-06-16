import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, act, fireEvent } from '@testing-library/react'
import { RestTimer } from '../RestTimer'
import { renderWithProviders } from '@/test/utils'

// fireEvent（同期）を使う。userEvent は fake timer と相性が悪く固まるため。
describe('RestTimer', () => {
  beforeEach(() => {
    localStorage.clear() // 永続化状態がテスト間で漏れないようにする
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('既定で 01:00 を表示する', () => {
    renderWithProviders(<RestTimer />)
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('プリセットで残り時間を切り替える', () => {
    renderWithProviders(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: '180秒' }))
    expect(screen.getByText('03:00')).toBeInTheDocument()
  })

  it('開始すると残り時間が減り、押下で一時停止に切り替わる', () => {
    renderWithProviders(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: '開始' }))
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('00:57')).toBeInTheDocument()
  })

  it('新しい保存状態（30分以内）は残り時間を復元する', () => {
    localStorage.setItem(
      'omome.restTimer',
      JSON.stringify({ duration: 90, running: false, remaining: 30, finished: false, savedAt: Date.now() - 5_000 }),
    )
    renderWithProviders(<RestTimer />)
    expect(screen.getByText('00:30')).toBeInTheDocument()
  })

  it('古い保存状態（30分超）は復元せず初期化する', () => {
    localStorage.setItem(
      'omome.restTimer',
      JSON.stringify({ duration: 90, running: false, remaining: 30, finished: false, savedAt: Date.now() - 31 * 60 * 1000 }),
    )
    renderWithProviders(<RestTimer />)
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('リセットで基準時間に戻る', () => {
    renderWithProviders(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: '開始' }))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('00:55')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'リセット' }))
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })
})
