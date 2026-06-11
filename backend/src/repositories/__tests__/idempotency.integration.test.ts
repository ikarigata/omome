import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../../db/client.js'
import * as schema from '../../db/schema.js'
import { workoutDays } from '../../db/schema.js'
import { createExercisesRepository } from '../exercisesRepository.js'
import { createWorkoutDaysRepository } from '../workoutDaysRepository.js'
import { createWorkoutRecordsRepository } from '../workoutRecordsRepository.js'
import { createWorkoutSetsRepository } from '../workoutSetsRepository.js'

// 実 SQLite（libSQL インメモリ）に対する冪等性の統合テスト。
// repository をモックするユニットテストでは捉えられない、実 DB の制約挙動
// （PK/UNIQUE 違反コード、部分 UNIQUE インデックス、updated_at トリガ）を検証する。
// schema.ts と同等の DDL をここで構築し、triggers.sql を適用する。

const DDL = `
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  cognito_sub TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE muscle_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE exercise_muscle_groups (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_id TEXT NOT NULL,
  muscle_group_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_emg_exercise_muscle_unique ON exercise_muscle_groups (exercise_id, muscle_group_id);
CREATE UNIQUE INDEX idx_emg_one_primary_per_exercise ON exercise_muscle_groups (exercise_id) WHERE is_primary = 1;
CREATE TABLE workout_days (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE workout_records (
  id TEXT PRIMARY KEY NOT NULL,
  workout_day_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_workout_records_day_exercise_unique ON workout_records (workout_day_id, exercise_id);
CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY NOT NULL,
  workout_record_id TEXT NOT NULL,
  reps INTEGER NOT NULL,
  weight TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`

const triggersSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../migrations/triggers.sql'),
  'utf8',
)

const ISO8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const EXERCISE_ID = 'bbbbbbbb-0000-4000-8000-000000000001'
const DAY_ID = 'cccccccc-0000-4000-8000-000000000001'
const RECORD_ID = 'dddddddd-0000-4000-8000-000000000001'
const MG1 = 'eeeeeeee-0000-4000-8000-000000000001'
const MG2 = 'eeeeeeee-0000-4000-8000-000000000002'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('idempotency (real libSQL)', () => {
  let client: Client
  let db: DB

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    await client.executeMultiple(DDL)
    await client.executeMultiple(triggersSql)
    db = drizzle({ client, schema }) as unknown as DB

    // 親レコードを用意（FK は :memory: 既定で未強制だが、現実的なデータで検証する）
    await client.execute({
      sql: 'INSERT INTO users (id, cognito_sub, name) VALUES (?, ?, ?)',
      args: [USER_ID, 'sub-1', '飛鳥'],
    })
    await client.execute({
      sql: 'INSERT INTO exercises (id, user_id, name) VALUES (?, ?, ?)',
      args: [EXERCISE_ID, USER_ID, 'ベンチプレス'],
    })
    await client.execute({
      sql: 'INSERT INTO workout_days (id, user_id, date) VALUES (?, ?, ?)',
      args: [DAY_ID, USER_ID, '2026-06-11'],
    })
    await client.execute({
      sql: 'INSERT INTO workout_records (id, workout_day_id, exercise_id) VALUES (?, ?, ?)',
      args: [RECORD_ID, DAY_ID, EXERCISE_ID],
    })
  })

  it('workout_days: 同一 id の二度挿入は PK 重複を吸収し isNew:false', async () => {
    const repo = createWorkoutDaysRepository(db)
    const id = 'cccccccc-0000-4000-8000-000000000002'
    const first = await repo.insert({ id, userId: USER_ID, date: '2026-06-12' })
    expect(first.isNew).toBe(true)
    const second = await repo.insert({ id, userId: USER_ID, date: '2026-06-12' })
    expect(second.isNew).toBe(false)
    expect(second.row.id).toBe(id)
  })

  it('workout_records: UNIQUE(day, exercise) 重複は合流し既存行を返す', async () => {
    const repo = createWorkoutRecordsRepository(db)
    // 別 id・同一 (day, exercise) → UNIQUE 違反 → 既存（beforeEach の RECORD_ID）に合流
    const merged = await repo.upsert({
      id: 'dddddddd-0000-4000-8000-000000000099',
      workoutDayId: DAY_ID,
      exerciseId: EXERCISE_ID,
    })
    expect(merged.isNew).toBe(false)
    expect(merged.row.id).toBe(RECORD_ID)
  })

  it('workout_sets: 同一 id の二度挿入は PK 重複を吸収し isNew:false', async () => {
    const repo = createWorkoutSetsRepository(db)
    const id = 'ffffffff-0000-4000-8000-000000000001'
    const first = await repo.insert({ id, workoutRecordId: RECORD_ID, reps: 10, weight: 62.5 })
    expect(first.isNew).toBe(true)
    expect(first.row.weight).toBe('62.5') // TEXT 格納で小数を厳密保持
    const second = await repo.insert({ id, workoutRecordId: RECORD_ID, reps: 10, weight: 62.5 })
    expect(second.isNew).toBe(false)
  })

  it('exercises: メイン部位2件は部分 UNIQUE 違反で upsert が null を返す', async () => {
    const repo = createExercisesRepository(db)
    const result = await repo.upsert(USER_ID, {
      id: 'bbbbbbbb-0000-4000-8000-000000000002',
      name: 'スクワット',
      muscleGroups: [
        { id: MG1, isPrimary: true },
        { id: MG2, isPrimary: true }, // メイン2件 → idx_emg_one_primary_per_exercise 違反
      ],
    })
    expect(result).toBeNull()
  })

  it('updated_at トリガ: UPDATE で ISO8601(Z) に自動更新され、無限再帰しない', async () => {
    const repo = createWorkoutDaysRepository(db)
    const before = await repo.findById(DAY_ID)
    expect(before!.updatedAt).toMatch(ISO8601_UTC)

    await sleep(5)
    await repo.update(DAY_ID, { title: '更新後' })

    const [after] = await db.select().from(workoutDays).where(eq(workoutDays.id, DAY_ID))
    expect(after.title).toBe('更新後')
    expect(after.updatedAt).toMatch(ISO8601_UTC)
    expect(after.updatedAt > before!.updatedAt).toBe(true)
  })
})
