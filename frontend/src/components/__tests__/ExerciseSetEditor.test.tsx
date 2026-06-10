import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ExerciseSetEditor } from '../ExerciseSetEditor'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/utils'

const BASE = '/api/v1'
// MSW のシード（data.ts）。この記録には 2 セットあり、1 セット目の reps は 10。
const RECORD_ID = 'r0000000-0000-4000-8000-000000000001'

describe('ExerciseSetEditor 数値入力の inputMode', () => {
  it('reps は numeric、weight は decimal を持つ（モバイル数字キーパッド用）', async () => {
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)
    // セット行（type=number → role spinbutton）が描画されるのを待つ
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2))

    const inputs = screen.getAllByRole('spinbutton')
    // 1行あたり [reps, weight] の順
    expect(inputs[0]).toHaveAttribute('inputmode', 'numeric')
    expect(inputs[1]).toHaveAttribute('inputmode', 'decimal')
  })
})

describe('ExerciseSetEditor 数値入力のクリア', () => {
  it('入力欄の値を消すと空のままになる（0 に戻らない）', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)

    const repsInput = (await screen.findAllByRole('spinbutton'))[0]!
    expect(repsInput).toHaveValue(10)

    await user.clear(repsInput)
    // 空のまま保持され、0 へ巻き戻らない
    expect(repsInput).toHaveValue(null)
  })
})

describe('ExerciseSetEditor 保存失敗時の挙動（保持＋手動リトライ）', () => {
  it('保存に失敗しても入力値を保持し、自動リトライせず、再試行ボタンで復帰する', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)

    const repsInput = (await screen.findAllByRole('spinbutton'))[0]!

    // 次の PUT を 1 回失敗させる
    server.use(http.put(`${BASE}/workout-sets/:id`, () => new HttpResponse(null, { status: 500 })))

    await user.clear(repsInput)
    await user.type(repsInput, '12')
    await user.tab() // blur → 保存

    // 失敗が表示され、入力値は保持される（ロールバックしない）
    expect(await screen.findByText('保存に失敗しました')).toBeInTheDocument()
    expect(repsInput).toHaveValue(12)

    // 自動リトライしないので、待っても失敗表示のまま
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()

    // 成功するハンドラに戻して再試行 → 失敗表示が消える
    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: '再試行' }))
    await waitFor(() => expect(screen.queryByText('保存に失敗しました')).not.toBeInTheDocument())
    expect(repsInput).toHaveValue(12)
  })
})
