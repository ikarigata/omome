import { createMiddleware } from 'hono/factory'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import type { UsersRepository } from '../repositories/usersRepository.js'
import type { HonoEnv } from '../types.js'

export function createAuthMiddleware(deps: { usersRepo: UsersRepository }) {
  const { usersRepo } = deps

  // cognito sub → users.id は不変なので、ウォームコンテナの生存中だけメモリにキャッシュする。
  // これで /api/v1/* の毎リクエストで走っていた findByCognitoSub の1往復を省ける。
  // 成功した解決のみキャッシュする（未作成ユーザーの 401 はキャッシュしない＝
  // post-confirmation トリガで users 行が作られた直後から正しく解決できるように）。
  const subToUserId = new Map<string, string>()

  return createMiddleware<HonoEnv>(async (c, next) => {
    const event = c.env.event as APIGatewayProxyEventV2WithJWTAuthorizer

    // HTTP API v2 JWT authorizer places claims in requestContext.authorizer.jwt.claims
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined

    if (!sub) {
      return c.json({ error: 'Unauthorized', message: 'Missing authentication' }, 401)
    }

    let userId = subToUserId.get(sub)

    if (userId === undefined) {
      const user = await usersRepo.findByCognitoSub(sub)
      if (!user) {
        return c.json({ error: 'Unauthorized', message: 'User not found' }, 401)
      }
      userId = user.id
      subToUserId.set(sub, userId)
    }

    c.set('userId', userId)

    await next()
  })
}
