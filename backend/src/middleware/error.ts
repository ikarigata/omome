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

// PostgreSQL unique violation error code
const PG_UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === PG_UNIQUE_VIOLATION
  )
}

export const errorHandler: ErrorHandler<HonoEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status)
  }

  console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }))
  return c.json({ error: 'Internal server error' }, 500)
}
