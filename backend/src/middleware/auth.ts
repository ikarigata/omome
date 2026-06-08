import { createMiddleware } from 'hono/factory'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import type { UsersRepository } from '../repositories/usersRepository.js'
import type { HonoEnv } from '../types.js'

export function createAuthMiddleware(deps: { usersRepo: UsersRepository }) {
  const { usersRepo } = deps

  return createMiddleware<HonoEnv>(async (c, next) => {
    const event = c.env.event as APIGatewayProxyEventV2WithJWTAuthorizer

    // HTTP API v2 JWT authorizer places claims in requestContext.authorizer.jwt.claims
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined

    if (!sub) {
      return c.json({ error: 'Unauthorized', message: 'Missing authentication' }, 401)
    }

    const user = await usersRepo.findByCognitoSub(sub)

    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'User not found' }, 401)
    }

    c.set('userId', user.id)

    await next()
  })
}
