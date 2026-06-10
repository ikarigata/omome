import { describe, it, expect } from 'vitest'
import { getPrimaryMuscleGroup, calcVolume, calcRM } from '../exercise'
import type { ExerciseResponse } from '@/api/types'

function ex(muscleGroups: ExerciseResponse['muscleGroups']): ExerciseResponse {
  return {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'x',
    description: null,
    muscleGroups,
    createdAt: '',
    updatedAt: '',
  }
}

describe('getPrimaryMuscleGroup', () => {
  it('isPrimary の部位を返す', () => {
    const e = ex([
      { id: 'a', name: '胸', isPrimary: false },
      { id: 'b', name: '肩', isPrimary: true },
    ])
    expect(getPrimaryMuscleGroup(e)?.name).toBe('肩')
  })

  it('isPrimary が無ければ先頭を返す', () => {
    const e = ex([
      { id: 'a', name: '胸', isPrimary: false },
      { id: 'b', name: '肩', isPrimary: false },
    ])
    expect(getPrimaryMuscleGroup(e)?.name).toBe('胸')
  })
})

describe('calcVolume', () => {
  it('reps * weight', () => {
    expect(calcVolume(10, 60)).toBe(600)
    expect(calcVolume(0, 60)).toBe(0)
  })
})

describe('calcRM', () => {
  it('reps<=0 は 0', () => {
    expect(calcRM(0, 100)).toBe(0)
  })
  it('reps=1 は weight そのまま', () => {
    expect(calcRM(1, 100)).toBe(100)
  })
  it('Epley 式（四捨五入）', () => {
    // 100 * (1 + 10/30) = 133.33 → 133
    expect(calcRM(10, 100)).toBe(133)
  })
})
