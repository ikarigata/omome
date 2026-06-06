import type { PostConfirmationTriggerEvent } from 'aws-lambda'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export const handler = async (event: PostConfirmationTriggerEvent) => {
  const { sub, name, email } = event.request.userAttributes

  if (!sub || !name) {
    console.error(JSON.stringify({ level: 'error', message: 'Missing sub or name', sub, name }))
    throw new Error('Missing required Cognito attributes: sub, name')
  }

  const id = crypto.randomUUID()

  await sql`
    INSERT INTO users (id, cognito_sub, name, email)
    VALUES (${id}, ${sub}, ${name}, ${email ?? null})
    ON CONFLICT (cognito_sub) DO NOTHING
  `

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
