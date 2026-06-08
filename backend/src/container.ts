import { db as defaultDb, type DB } from './db/client.js'
import { createExercisesRepository } from './repositories/exercisesRepository.js'
import { createMuscleGroupsRepository } from './repositories/muscleGroupsRepository.js'
import { createUsersRepository } from './repositories/usersRepository.js'
import { createWorkoutDaysRepository } from './repositories/workoutDaysRepository.js'
import { createWorkoutRecordsRepository } from './repositories/workoutRecordsRepository.js'
import { createWorkoutSetsRepository } from './repositories/workoutSetsRepository.js'
import { createExercisesService } from './services/exercisesService.js'
import { createMuscleGroupsService } from './services/muscleGroupsService.js'
import { createUsersService } from './services/usersService.js'
import { createWorkoutDaysService } from './services/workoutDaysService.js'
import { createWorkoutRecordsService } from './services/workoutRecordsService.js'
import { createWorkoutSetsService } from './services/workoutSetsService.js'

/**
 * Composition root: wires db → repositories → services in one place.
 * The db can be overridden (e.g. for integration tests against a test database);
 * service-level unit tests inject mock repositories directly and bypass this.
 */
export function createContainer(db: DB = defaultDb) {
  const exercisesRepo = createExercisesRepository(db)
  const muscleGroupsRepo = createMuscleGroupsRepository(db)
  const usersRepo = createUsersRepository(db)
  const workoutDaysRepo = createWorkoutDaysRepository(db)
  const workoutRecordsRepo = createWorkoutRecordsRepository(db)
  const workoutSetsRepo = createWorkoutSetsRepository(db)

  const repositories = {
    exercisesRepo,
    muscleGroupsRepo,
    usersRepo,
    workoutDaysRepo,
    workoutRecordsRepo,
    workoutSetsRepo,
  }

  const services = {
    exercisesService: createExercisesService({ exercisesRepo }),
    muscleGroupsService: createMuscleGroupsService({ muscleGroupsRepo }),
    usersService: createUsersService({ usersRepo }),
    workoutDaysService: createWorkoutDaysService({ workoutDaysRepo }),
    workoutRecordsService: createWorkoutRecordsService({
      workoutRecordsRepo,
      workoutDaysRepo,
      exercisesRepo,
    }),
    workoutSetsService: createWorkoutSetsService({
      workoutSetsRepo,
      workoutRecordsRepo,
      workoutDaysRepo,
    }),
  }

  return { repositories, services }
}

export type Container = ReturnType<typeof createContainer>
