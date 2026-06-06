import { Hono } from 'hono'
import type { HonoEnv } from './types.js'
import { authMiddleware } from './middleware/auth.js'
import { errorHandler } from './middleware/error.js'
import { exercisesController } from './controllers/exercisesController.js'
import { muscleGroupsController } from './controllers/muscleGroupsController.js'
import { workoutDaysController } from './controllers/workoutDaysController.js'
import { workoutRecordsController } from './controllers/workoutRecordsController.js'
import { workoutSetsController } from './controllers/workoutSetsController.js'
import { usersController } from './controllers/usersController.js'

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

app.use('/api/v1/*', authMiddleware)

const v1 = new Hono<HonoEnv>()

v1.route('/exercises', exercisesController)
v1.route('/muscle-groups', muscleGroupsController)
v1.route('/workout-days', workoutDaysController)
v1.route('/workout-records', workoutRecordsController)
v1.route('/workout-sets', workoutSetsController)
v1.route('/users', usersController)

app.route('/api/v1', v1)

app.get('/health', (c) => c.json({ status: 'ok' }))
