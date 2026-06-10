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
    // 1行あたり [weight, reps] の順（左=重量 / 右=回数）
    expect(inputs[0]).toHaveAttribute('inputmode', 'decimal')
    expect(inputs[1]).toHaveAttribute('inputmode', 'numeric')
  })
})

describe('ExerciseSetEditor 数値入力のクリア', () => {
  it('入力欄の値を消すと空のままになる（0 に戻らない）', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)

    // 並びは [weight, reps] なので回数入力は 2 番目。
    const repsInput = (await screen.findAllByRole('spinbutton'))[1]!
    expect(repsInput).toHaveValue(10)

    await user.clear(repsInput)
    // 空のまま保持され、0 へ巻き戻らない
    expect(repsInput).toHaveValue(null)
  })
})

describe('ExerciseSetEditor フォーカス遷移（タップ手数の削減）', () => {
  // 1 行 = [weight, reps] の並び。新規行の重量は末尾から 2 番目。
  it('セット追加直後は新しい行の重量入力へフォーカスが当たる', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2))
    const before = screen.getAllByRole('spinbutton').length

    await user.click(screen.getByRole('button', { name: /セットを追加/ }))

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs).toHaveLength(before + 2)
      expect(document.activeElement).toBe(inputs[inputs.length - 2]) // 新規行の重量
    })
  })

  it('重量入力で Enter を押すと回数入力へフォーカスが移る', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2))

    // 1 行目は [weight, reps]。重量で Enter → 同じ行の回数へ。
    const [weight, reps] = screen.getAllByRole('spinbutton')
    await user.click(weight!)
    await user.keyboard('60{Enter}')

    expect(document.activeElement).toBe(reps)
  })

  it('回数入力で Enter を押すと次セットの重量へフォーカスが移る', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(4))

    // [w0, r0, w1, r1, ...]。1 行目の回数(r0)で Enter → 2 行目の重量(w1)へ。
    const inputs = screen.getAllByRole('spinbutton')
    await user.click(inputs[1]!) // r0
    await user.keyboard('{Enter}')

    expect(document.activeElement).toBe(inputs[2]) // w1
  })

  it('最終セットの回数で Enter を押すと新規セットを作成し重量へフォーカスする', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2))
    const before = screen.getAllByRole('spinbutton').length

    // 末尾の入力 = 最終セットの回数。Enter で新規セット作成。
    await user.click(screen.getAllByRole('spinbutton')[before - 1]!)
    await user.keyboard('{Enter}')

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs).toHaveLength(before + 2)
      expect(document.activeElement).toBe(inputs[inputs.length - 2]) // 新規行の重量
    })
  })

  it('autoStart 指定でセットが無ければ 1 セット自動作成し重量へフォーカスする', async () => {
    const EMPTY_RECORD = 'r0000000-0000-4000-8000-0000000000ff'
    renderWithProviders(<ExerciseSetEditor workoutRecordId={EMPTY_RECORD} autoStart />)

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs).toHaveLength(2)
      expect(document.activeElement).toBe(inputs[0]) // [weight, reps] の重量
    })
  })
})

describe('ExerciseSetEditor 保存失敗時の挙動（保持＋手動リトライ）', () => {
  it('保存に失敗しても入力値を保持し、自動リトライせず、再試行ボタンで復帰する', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)

    // 並びは [weight, reps] なので回数入力は 2 番目。
    const repsInput = (await screen.findAllByRole('spinbutton'))[1]!

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
