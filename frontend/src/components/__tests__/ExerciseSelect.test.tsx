import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseSelect } from '../ExerciseSelect'
import { renderWithProviders } from '@/test/utils'
import { exercises } from '@/mocks/data'

// ベンチプレス（胸・腕）と スクワット（脚）の2件を選択肢にする。
const bench = exercises.find((e) => e.name === 'ベンチプレス')!
const squat = exercises.find((e) => e.name === 'スクワット')!
const available = [bench, squat]

function renderSelect(
  props: Partial<React.ComponentProps<typeof ExerciseSelect>> = {},
) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <ExerciseSelect available={available} onSelect={onSelect} onClose={onClose} {...props} />,
  )
  return { onSelect, onClose }
}

describe('ExerciseSelect', () => {
  it('available の種目一覧を表示する', async () => {
    renderSelect()
    // 部位マスタ（MSW 経由・非同期）が揃ってからタブとリストを一緒に描画する。
    await waitFor(() => expect(screen.getByText('ベンチプレス')).toBeInTheDocument())
    expect(screen.getByText('スクワット')).toBeInTheDocument()
  })

  it('種目をクリックすると onSelect にその id を渡す', async () => {
    const { onSelect } = renderSelect()
    await waitFor(() => expect(screen.getByText('ベンチプレス')).toBeInTheDocument())
    await userEvent.click(screen.getByText('ベンチプレス'))
    expect(onSelect).toHaveBeenCalledWith(bench.id)
  })

  it('「閉じる」で onClose を呼ぶ', async () => {
    const { onClose } = renderSelect()
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('出現する部位だけを「すべて」付きでタブ表示する', async () => {
    renderSelect()
    // useMuscleGroups は MSW 経由で非同期に読み込まれる。
    await waitFor(() => expect(screen.getByRole('button', { name: 'すべて' })).toBeInTheDocument())
    // available に含まれる部位（胸・腕・脚）のみ。肩や背中などは出ない。
    expect(screen.getByRole('button', { name: '胸' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '腕' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '脚' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '肩' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '背中' })).not.toBeInTheDocument()
  })

  it('部位タブで一覧を絞り込み、「すべて」で元に戻る', async () => {
    renderSelect()
    await waitFor(() => expect(screen.getByRole('button', { name: '脚' })).toBeInTheDocument())

    // 「脚」を選ぶとスクワットだけ残る。
    await userEvent.click(screen.getByRole('button', { name: '脚' }))
    expect(screen.getByText('スクワット')).toBeInTheDocument()
    expect(screen.queryByText('ベンチプレス')).not.toBeInTheDocument()

    // 「すべて」で両方戻る。
    await userEvent.click(screen.getByRole('button', { name: 'すべて' }))
    expect(screen.getByText('ベンチプレス')).toBeInTheDocument()
    expect(screen.getByText('スクワット')).toBeInTheDocument()
  })

  it('available が空ならタブを出さず、空メッセージを表示する', async () => {
    renderSelect({ available: [] })
    await waitFor(() => expect(screen.getByText('追加できる種目がありません')).toBeInTheDocument())
    // 部位マスタが読み込まれてもタブは描画されない。
    expect(screen.queryByRole('button', { name: 'すべて' })).not.toBeInTheDocument()
  })
})
