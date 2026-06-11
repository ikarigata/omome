import { createClient } from '@libsql/client/web'
import type { PostConfirmationTriggerEvent } from 'aws-lambda'

// Lambda ランタイムでは pure-JS の web クライアントを使う（ネイティブバイナリを
// バンドルしないため）。Turso へは HTTPS リモート接続（libsql:// スキーム）。
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export const handler = async (event: PostConfirmationTriggerEvent) => {
  const { sub, name, email } = event.request.userAttributes

  if (!sub || !name) {
    console.error(JSON.stringify({ level: 'error', message: 'Missing sub or name', sub, name }))
    throw new Error('Missing required Cognito attributes: sub, name')
  }

  const id = crypto.randomUUID()

  await client.execute({
    sql: 'INSERT INTO users (id, cognito_sub, name, email) VALUES (?, ?, ?, ?) ON CONFLICT (cognito_sub) DO NOTHING',
    args: [id, sub, name, email ?? null],
  })

  console.log(
    JSON.stringify({
      level: 'info',
      message: 'users row created',
      userId: id,
      cognitoSub: sub,
    }),
  )

  return event
}
