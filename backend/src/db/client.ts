import { createClient } from '@libsql/client/web'
// drizzle-orm/libsql のデフォルトエントリは require('@libsql/client')（ネイティブ版）を
// 引き込み、Lambda で `Cannot find module '@libsql/linux-x64-gnu'` を起こす。web サブパス
// は @libsql/client/web（pure-JS）を使うのでこちらを import する。
import { drizzle } from 'drizzle-orm/libsql/web'
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
