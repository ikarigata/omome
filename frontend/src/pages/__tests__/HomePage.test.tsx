import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useParams } from 'react-router-dom'
import { HomePage } from '../HomePage'
import { renderWithProviders } from '@/test/utils'

function WorkoutDayStub() {
  const { id } = useParams()
  return <div>workout-day:{id}</div>
}

describe('HomePage', () => {
  it('ワークアウト日の一覧（メモ）を表示する', async () => {
    renderWithProviders(<HomePage />)
    await waitFor(() => expect(screen.getByText('調子よかった')).toBeInTheDocument())
  })

  it('ユーザー名をヘッダに表示する', async () => {
    renderWithProviders(<HomePage />)
    await waitFor(() => expect(screen.getByText(/のトレーニング/)).toBeInTheDocument())
  })

  it('＋ボタン押下時、本日の登録が既にあればその日のトレーニング画面へ遷移する（1日1登録）', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/workout/:id" element={<WorkoutDayStub />} />
      </Routes>,
    )

    // 一覧の読み込み完了（本日分 = モックのメモ「調子よかった」が存在する）を待つ
    await waitFor(() => expect(screen.getByText('調子よかった')).toBeInTheDocument())

    await user.click(screen.getByLabelText('今日のトレーニングを追加'))

    // 新規作成せず、本日の既存ワークアウト日へ遷移する
    await waitFor(() =>
      expect(
        screen.getByText('workout-day:d0000000-0000-4000-8000-000000000001'),
      ).toBeInTheDocument(),
    )
  })
})
