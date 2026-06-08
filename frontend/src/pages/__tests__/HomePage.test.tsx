import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { HomePage } from '../HomePage'
import { renderWithProviders } from '@/test/utils'

describe('HomePage', () => {
  it('ワークアウト日の一覧（タイトル）を表示する', async () => {
    renderWithProviders(<HomePage />)
    await waitFor(() => expect(screen.getByText('胸の日')).toBeInTheDocument())
    expect(screen.getByText('脚の日')).toBeInTheDocument()
    // タイトル未設定の日
    expect(screen.getByText('タイトルなし')).toBeInTheDocument()
  })

  it('ユーザー名をヘッダに表示する', async () => {
    renderWithProviders(<HomePage />)
    await waitFor(() => expect(screen.getByText(/のトレーニング/)).toBeInTheDocument())
  })
})
