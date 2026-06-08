import { Hono } from 'hono'
import type { MuscleGroupsService } from '../services/muscleGroupsService.js'
import type { HonoEnv } from '../types.js'

export function createMuscleGroupsController(deps: { muscleGroupsService: MuscleGroupsService }) {
  const { muscleGroupsService } = deps
  const controller = new Hono<HonoEnv>()

  controller.get('/', async (c) => {
    const groups = await muscleGroupsService.getAll()
    return c.json(groups)
  })

  controller.get('/:id', async (c) => {
    const group = await muscleGroupsService.getById(c.req.param('id'))
    return c.json(group)
  })

  return controller
}
