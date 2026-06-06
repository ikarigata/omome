import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

// Initialize outside the handler to reuse on warm starts
const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle({ client: sql, schema })

export type DB = typeof db
