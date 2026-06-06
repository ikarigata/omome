import { Hono } from 'hono'
import { muscleGroupsService } from '../services/muscleGroupsService.js'
import type { HonoEnv } from '../types.js'

export const muscleGroupsController = new Hono<HonoEnv>()

muscleGroupsController.get('/', async (c) => {
  const groups = await muscleGroupsService.getAll()
  return c.json(groups)
})

muscleGroupsController.get('/:id', async (c) => {
  const group = await muscleGroupsService.getById(c.req.param('id'))
  return c.json(group)
})
