import { Hono } from 'hono'
import type { HonoEnv } from './types.js'
import { createContainer } from './container.js'
import { createAuthMiddleware } from './middleware/auth.js'
import { errorHandler } from './middleware/error.js'
import { createExercisesController } from './controllers/exercisesController.js'
import { createMuscleGroupsController } from './controllers/muscleGroupsController.js'
import { createWorkoutDaysController } from './controllers/workoutDaysController.js'
import { createWorkoutRecordsController } from './controllers/workoutRecordsController.js'
import { createWorkoutSetsController } from './controllers/workoutSetsController.js'
import { createUsersController } from './controllers/usersController.js'

const { repositories, services } = createContainer()

export const app = new Hono<HonoEnv>()

app.onError(errorHandler)

// Structured request logging
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(
    JSON.stringify({
      level: 'info',
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms,
    }),
  )
})

app.use('/api/v1/*', createAuthMiddleware({ usersRepo: repositories.usersRepo }))

const v1 = new Hono<HonoEnv>()

v1.route('/exercises', createExercisesController({ exercisesService: services.exercisesService }))
v1.route(
  '/muscle-groups',
  createMuscleGroupsController({ muscleGroupsService: services.muscleGroupsService }),
)
v1.route(
  '/workout-days',
  createWorkoutDaysController({
    workoutDaysService: services.workoutDaysService,
    workoutRecordsService: services.workoutRecordsService,
  }),
)
v1.route(
  '/workout-records',
  createWorkoutRecordsController({
    workoutRecordsService: services.workoutRecordsService,
    workoutSetsService: services.workoutSetsService,
  }),
)
v1.route('/workout-sets', createWorkoutSetsController({ workoutSetsService: services.workoutSetsService }))
v1.route('/users', createUsersController({ usersService: services.usersService }))

app.route('/api/v1', v1)

app.get('/health', (c) => c.json({ status: 'ok' }))
