import type { ExerciseResponse } from '@/api/types'

export function getPrimaryMuscleGroup(exercise: ExerciseResponse) {
  return exercise.muscleGroups.find((g) => g.isPrimary) ?? exercise.muscleGroups[0]
}

export function calcVolume(reps: number, weight: number): number {
  return reps * weight
}

export function calcRM(reps: number, weight: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}
