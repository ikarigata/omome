import { createClient } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

// Lambda ランタイムでは pure-JS の web クライアントを使う（ネイティブバイナリを
// バンドルしないため）。Turso へは HTTPS リモート接続（libsql:// スキーム）。
// Initialize outside the handler to reuse on warm starts.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export const db = drizzle({ client, schema })

export type DB = typeof db
