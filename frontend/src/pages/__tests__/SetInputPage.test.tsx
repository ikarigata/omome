import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { SetInputPage } from '../SetInputPage'
import { renderWithProviders } from '@/test/utils'

// MSW のシードに存在する日 / 種目（data.ts）。この日・種目には記録とセットがある。
const WORKOUT_ID = 'd0000000-0000-4000-8000-000000000001'
const EXERCISE_ID = 'e0000000-0000-4000-8000-000000000001'

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/workout/:workoutId/exercise/:exerciseId" element={<SetInputPage />} />
    </Routes>,
    { initialEntries: [`/workout/${WORKOUT_ID}/exercise/${EXERCISE_ID}`] },
  )
}

describe('SetInputPage 数値入力の inputMode', () => {
  it('reps / subReps は numeric、weight は decimal を持つ（モバイル数字キーパッド用）', async () => {
    renderPage()
    // セット行（type=number → role spinbutton）が描画されるのを待つ
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(3))

    const inputs = screen.getAllByRole('spinbutton')
    // 1行あたり [reps, subReps, weight] の順
    expect(inputs[0]).toHaveAttribute('inputmode', 'numeric')
    expect(inputs[1]).toHaveAttribute('inputmode', 'numeric')
    expect(inputs[2]).toHaveAttribute('inputmode', 'decimal')
  })
})
