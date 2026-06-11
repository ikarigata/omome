import { relations, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// タイムスタンプの DEFAULT。SQLite には timestamptz が無いため TEXT に ISO8601 UTC
// （ミリ秒 + 末尾 Z）で保存する。strftime('%Y-%m-%dT%H:%M:%fZ','now') は UTC を返し、
// JS の new Date() がそのまま解釈でき、辞書順 = 時系列順になる。
// updated_at の自動更新は drizzle-kit が生成しないため AFTER UPDATE トリガで行う
// （backend/migrations/0000_triggers.sql / migrate.sh で適用）。
const tsNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`

export const users = sqliteTable('users', {
  id: text('id').notNull().primaryKey(),
  cognitoSub: text('cognito_sub').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  createdAt: text('created_at').notNull().default(tsNow),
  updatedAt: text('updated_at').notNull().default(tsNow),
})

export const muscleGroups = sqliteTable('muscle_groups', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().default(tsNow),
})

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: text('created_at').notNull().default(tsNow),
    updatedAt: text('updated_at').notNull().default(tsNow),
  },
  (table) => [index('idx_exercises_user_id').on(table.userId)],
)

export const exerciseMuscleGroups = sqliteTable(
  'exercise_muscle_groups',
  {
    id: text('id').notNull().primaryKey(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    muscleGroupId: text('muscle_group_id')
      .notNull()
      .references(() => muscleGroups.id, { onDelete: 'cascade' }),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    // UNIQUE(exercise_id, muscle_group_id) — prevent duplicate muscle group per exercise
    uniqueIndex('idx_emg_exercise_muscle_unique').on(table.exerciseId, table.muscleGroupId),
    // Partial unique index: only one primary per exercise（bool は整数格納なので = 1）
    uniqueIndex('idx_emg_one_primary_per_exercise')
      .on(table.exerciseId)
      .where(sql`${table.isPrimary} = 1`),
    index('idx_emg_muscle_group_id').on(table.muscleGroupId),
  ],
)

export const workoutDays = sqliteTable(
  'workout_days',
  {
    id: text('id').notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    title: text('title'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(tsNow),
    updatedAt: text('updated_at').notNull().default(tsNow),
  },
  (table) => [index('idx_workout_days_user_id').on(table.userId)],
)

export const workoutRecords = sqliteTable(
  'workout_records',
  {
    id: text('id').notNull().primaryKey(),
    workoutDayId: text('workout_day_id')
      .notNull()
      .references(() => workoutDays.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(tsNow),
    updatedAt: text('updated_at').notNull().default(tsNow),
  },
  (table) => [
    // UNIQUE(workout_day_id, exercise_id) — one record per exercise per day
    uniqueIndex('idx_workout_records_day_exercise_unique').on(table.workoutDayId, table.exerciseId),
    index('idx_workout_records_exercise_id').on(table.exerciseId),
  ],
)

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').notNull().primaryKey(),
    workoutRecordId: text('workout_record_id')
      .notNull()
      .references(() => workoutRecords.id, { onDelete: 'cascade' }),
    reps: integer('reps').notNull(),
    // numeric 相当。小数の桁を厳密保持するため TEXT に格納する
    // （repository が String() で挿入 / Number() で取得する）。
    weight: text('weight').notNull(),
    // 実績内での表示順。ドラッグ並べ替えで永続化する。既存行は DEFAULT 0 で取り込み、
    // 同値は created_at で安定ソートする。新規挿入時はアプリ側が末尾(max+1)を明示セットする。
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull().default(tsNow),
    updatedAt: text('updated_at').notNull().default(tsNow),
  },
  (table) => [index('idx_workout_sets_workout_record_id').on(table.workoutRecordId)],
)

// Relations for Drizzle query builder
export const usersRelations = relations(users, ({ many }) => ({
  exercises: many(exercises),
  workoutDays: many(workoutDays),
}))

export const muscleGroupsRelations = relations(muscleGroups, ({ many }) => ({
  exerciseMuscleGroups: many(exerciseMuscleGroups),
}))

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, { fields: [exercises.userId], references: [users.id] }),
  muscleGroups: many(exerciseMuscleGroups),
  workoutRecords: many(workoutRecords),
}))

export const exerciseMuscleGroupsRelations = relations(exerciseMuscleGroups, ({ one }) => ({
  exercise: one(exercises, {
    fields: [exerciseMuscleGroups.exerciseId],
    references: [exercises.id],
  }),
  muscleGroup: one(muscleGroups, {
    fields: [exerciseMuscleGroups.muscleGroupId],
    references: [muscleGroups.id],
  }),
}))

export const workoutDaysRelations = relations(workoutDays, ({ one, many }) => ({
  user: one(users, { fields: [workoutDays.userId], references: [users.id] }),
  workoutRecords: many(workoutRecords),
}))

export const workoutRecordsRelations = relations(workoutRecords, ({ one, many }) => ({
  workoutDay: one(workoutDays, {
    fields: [workoutRecords.workoutDayId],
    references: [workoutDays.id],
  }),
  exercise: one(exercises, {
    fields: [workoutRecords.exerciseId],
    references: [exercises.id],
  }),
  workoutSets: many(workoutSets),
}))

export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  workoutRecord: one(workoutRecords, {
    fields: [workoutSets.workoutRecordId],
    references: [workoutRecords.id],
  }),
}))
