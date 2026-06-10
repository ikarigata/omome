import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').notNull().primaryKey(),
  cognitoSub: text('cognito_sub').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const muscleGroups = pgTable('muscle_groups', {
  id: uuid('id').notNull().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [index('idx_exercises_user_id').on(table.userId)],
)

export const exerciseMuscleGroups = pgTable(
  'exercise_muscle_groups',
  {
    id: uuid('id').notNull().primaryKey(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    muscleGroupId: uuid('muscle_group_id')
      .notNull()
      .references(() => muscleGroups.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (table) => [
    // UNIQUE(exercise_id, muscle_group_id) — prevent duplicate muscle group per exercise
    uniqueIndex('idx_emg_exercise_muscle_unique').on(table.exerciseId, table.muscleGroupId),
    // Partial unique index: only one primary per exercise
    uniqueIndex('idx_emg_one_primary_per_exercise')
      .on(table.exerciseId)
      .where(sql`${table.isPrimary} = true`),
    index('idx_emg_muscle_group_id').on(table.muscleGroupId),
  ],
)

export const workoutDays = pgTable(
  'workout_days',
  {
    id: uuid('id').notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    title: text('title'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [index('idx_workout_days_user_id').on(table.userId)],
)

export const workoutRecords = pgTable(
  'workout_records',
  {
    id: uuid('id').notNull().primaryKey(),
    workoutDayId: uuid('workout_day_id')
      .notNull()
      .references(() => workoutDays.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [
    // UNIQUE(workout_day_id, exercise_id) — one record per exercise per day
    uniqueIndex('idx_workout_records_day_exercise_unique').on(table.workoutDayId, table.exerciseId),
    index('idx_workout_records_exercise_id').on(table.exerciseId),
  ],
)

export const workoutSets = pgTable(
  'workout_sets',
  {
    id: uuid('id').notNull().primaryKey(),
    workoutRecordId: uuid('workout_record_id')
      .notNull()
      .references(() => workoutRecords.id, { onDelete: 'cascade' }),
    reps: integer('reps').notNull(),
    weight: numeric('weight').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
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
