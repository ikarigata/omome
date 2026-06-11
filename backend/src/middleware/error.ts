import type { ErrorHandler } from 'hono'
import type { HonoEnv } from '../types.js'

export class AppError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message)
  }
}

// SQLite / libSQL の「PK 重複 / UNIQUE 重複」判定。
// 冪等性（クライアント生成 UUID + 重複→既存返却 200）の要。PostgreSQL の 23505 は
// PK も UNIQUE も一括だったが、libSQL はエラー表現が接続経路で異なるため複数経路で拾う:
//   - local（:memory: テスト等）: code='SQLITE_CONSTRAINT'、拡張コードは rawCode（数値）
//       1555 = SQLITE_CONSTRAINT_PRIMARYKEY / 2067 = SQLITE_CONSTRAINT_UNIQUE
//   - remote（Turso/hrana）: code に拡張コード文字列が入る場合がある
// NOT NULL / FOREIGN KEY / CHECK 違反は「重複」ではないので除外しなければならない
//   （ID 欠落の NOT NULL 違反などは握りつぶさず 500 として顕在化させる方針）。
//   SQLite は PK 重複も "UNIQUE constraint failed" と表現するため、メッセージで判別できる。
const SQLITE_PK_VIOLATION = 1555
const SQLITE_UNIQUE_VIOLATION = 2067

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; rawCode?: unknown; message?: unknown }

  if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true
  if (e.rawCode === SQLITE_PK_VIOLATION || e.rawCode === SQLITE_UNIQUE_VIOLATION) return true
  if (e.code === 'SQLITE_CONSTRAINT' && typeof e.message === 'string') {
    return /UNIQUE constraint failed/i.test(e.message)
  }
  return false
}

export const errorHandler: ErrorHandler<HonoEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status)
  }

  console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }))
  return c.json({ error: 'Internal server error' }, 500)
}
