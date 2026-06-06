import { createMiddleware } from 'hono/factory'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import type { HonoEnv } from '../types.js'

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const event = c.env.event as APIGatewayProxyEventV2WithJWTAuthorizer

  // HTTP API v2 JWT authorizer places claims in requestContext.authorizer.jwt.claims
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined

  if (!sub) {
    return c.json({ error: 'Unauthorized', message: 'Missing authentication' }, 401)
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.cognitoSub, sub))

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'User not found' }, 401)
  }

  c.set('userId', user.id)

  await next()
})
