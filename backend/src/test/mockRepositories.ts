import { vi } from 'vitest'
import type { ExercisesRepository } from '../repositories/exercisesRepository.js'
import type { MuscleGroupsRepository } from '../repositories/muscleGroupsRepository.js'
import type { UsersRepository } from '../repositories/usersRepository.js'
import type { WorkoutDaysRepository } from '../repositories/workoutDaysRepository.js'
import type { WorkoutRecordsRepository } from '../repositories/workoutRecordsRepository.js'
import type { WorkoutSetsRepository } from '../repositories/workoutSetsRepository.js'

/**
 * Typed mock repositories for service-layer unit tests. Every async method is a
 * `vi.fn()` — configure return values per test with `vi.mocked(repo.x).mockResolvedValue(...)`.
 * `sortMuscleGroups` keeps the real (pure) implementation because `toResponse` relies on it.
 */

export function createMockExercisesRepository(): ExercisesRepository {
  return {
    findAllByUser: vi.fn(),
    findById: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    // real pure implementation: primary first
    sortMuscleGroups: (mgs: Array<{ isPrimary: boolean }>) =>
      [...mgs].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)),
  } as unknown as ExercisesRepository
}

export function createMockMuscleGroupsRepository(): MuscleGroupsRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
  } as unknown as MuscleGroupsRepository
}

export function createMockUsersRepository(): UsersRepository {
  return {
    findById: vi.fn(),
    findByCognitoSub: vi.fn(),
    update: vi.fn(),
  } as unknown as UsersRepository
}

export function createMockWorkoutDaysRepository(): WorkoutDaysRepository {
  return {
    findAllByUser: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findCalendarMonth: vi.fn(),
  } as unknown as WorkoutDaysRepository
}

export function createMockWorkoutRecordsRepository(): WorkoutRecordsRepository {
  return {
    findAll: vi.fn(),
    findByWorkoutDay: vi.fn(),
    findById: vi.fn(),
    findByDayAndExercise: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as WorkoutRecordsRepository
}

export function createMockWorkoutSetsRepository(): WorkoutSetsRepository {
  return {
    findByWorkoutRecord: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
  } as unknown as WorkoutSetsRepository
}
