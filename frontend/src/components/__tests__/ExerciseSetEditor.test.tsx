import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { ExerciseSetEditor } from '../ExerciseSetEditor'
import { renderWithProviders } from '@/test/utils'

// MSW のシード（data.ts）。この記録には 2 セットある。
const RECORD_ID = 'r0000000-0000-4000-8000-000000000001'

describe('ExerciseSetEditor 数値入力の inputMode', () => {
  it('reps / subReps は numeric、weight は decimal を持つ（モバイル数字キーパッド用）', async () => {
    renderWithProviders(<ExerciseSetEditor workoutRecordId={RECORD_ID} />)
    // セット行（type=number → role spinbutton）が描画されるのを待つ
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(3))

    const inputs = screen.getAllByRole('spinbutton')
    // 1行あたり [reps, subReps, weight] の順
    expect(inputs[0]).toHaveAttribute('inputmode', 'numeric')
    expect(inputs[1]).toHaveAttribute('inputmode', 'numeric')
    expect(inputs[2]).toHaveAttribute('inputmode', 'decimal')
  })
})
