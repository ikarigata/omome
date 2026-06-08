import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExercisesPage } from '../ExercisesPage'
import { renderWithProviders } from '@/test/utils'

describe('ExercisesPage', () => {
  it('種目一覧を表示する', async () => {
    renderWithProviders(<ExercisesPage />)
    await waitFor(() => expect(screen.getByText('ベンチプレス')).toBeInTheDocument())
    expect(screen.getByText('スクワット')).toBeInTheDocument()
  })

  it('「種目を追加」で新規フォームを開く', async () => {
    renderWithProviders(<ExercisesPage />)
    await waitFor(() => expect(screen.getByText('ベンチプレス')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }))
    expect(screen.getByText('新規種目')).toBeInTheDocument()
    expect(screen.getByLabelText('種目名')).toBeInTheDocument()
  })

  it('種目名未入力で保存するとバリデーションエラー', async () => {
    renderWithProviders(<ExercisesPage />)
    await waitFor(() => expect(screen.getByText('ベンチプレス')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }))
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('種目名を入力してください')).toBeInTheDocument()
  })

  it('部位未選択だと部位選択のエラー', async () => {
    renderWithProviders(<ExercisesPage />)
    await waitFor(() => expect(screen.getByText('ベンチプレス')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }))
    await userEvent.type(screen.getByLabelText('種目名'), 'ニューエクササイズ')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('部位を1つ以上選択してください')).toBeInTheDocument()
  })
})
