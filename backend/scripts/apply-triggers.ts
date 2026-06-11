import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

// migrations/triggers.sql（updated_at 自動更新トリガ）を Turso に適用する。
// drizzle-kit push はトリガを扱わないため、push 後にこれを流す（migrate.sh）。
// executeMultiple は複数ステートメント（BEGIN...END; を含む）をまとめて実行する。
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), '../migrations/triggers.sql')
const sql = readFileSync(sqlPath, 'utf8')

await client.executeMultiple(sql)
console.log('Applied updated_at triggers')
