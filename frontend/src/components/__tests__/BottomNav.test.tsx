import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { BottomNav } from '../BottomNav'
import { renderWithProviders } from '@/test/utils'

describe('BottomNav', () => {
  it('ホーム/カレンダー/種目 を表示する（今日・統計は無い）', () => {
    renderWithProviders(<BottomNav />)
    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('カレンダー')).toBeInTheDocument()
    expect(screen.getByText('種目')).toBeInTheDocument()
    expect(screen.queryByText('今日')).not.toBeInTheDocument()
    expect(screen.queryByText('統計')).not.toBeInTheDocument()
  })

  it('現在ルートのタブがアクティブ表示になる', () => {
    renderWithProviders(<BottomNav />, { initialEntries: ['/calendar'] })
    const calendarLink = screen.getByText('カレンダー').closest('a')
    expect(calendarLink).toHaveClass('opacity-100')
    const homeLink = screen.getByText('ホーム').closest('a')
    expect(homeLink).toHaveClass('opacity-60')
  })
})
