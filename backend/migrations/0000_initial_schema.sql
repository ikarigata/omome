-- =============================================================================
-- omome 初期スキーマ
-- =============================================================================

CREATE TABLE users (
    id          uuid        NOT NULL PRIMARY KEY,
    cognito_sub text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    email       text        UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE muscle_groups (
    id         uuid        NOT NULL PRIMARY KEY,
    name       text        NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exercises (
    id          uuid        NOT NULL PRIMARY KEY,
    user_id     uuid        NOT NULL,
    name        text        NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exercises_user_id ON exercises(user_id);

CREATE TABLE exercise_muscle_groups (
    id              uuid    NOT NULL PRIMARY KEY,
    exercise_id     uuid    NOT NULL,
    muscle_group_id uuid    NOT NULL,
    is_primary      boolean NOT NULL DEFAULT false,
    FOREIGN KEY (exercise_id)     REFERENCES exercises(id)      ON DELETE CASCADE,
    FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)  ON DELETE CASCADE,
    UNIQUE (exercise_id, muscle_group_id)
);

CREATE UNIQUE INDEX idx_emg_one_primary_per_exercise
    ON exercise_muscle_groups(exercise_id)
    WHERE is_primary;

CREATE INDEX idx_emg_muscle_group_id ON exercise_muscle_groups(muscle_group_id);

CREATE TABLE workout_days (
    id         uuid        NOT NULL PRIMARY KEY,
    user_id    uuid        NOT NULL,
    date       date        NOT NULL DEFAULT CURRENT_DATE,
    title      text,
    notes      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_workout_days_user_id ON workout_days(user_id);

CREATE TABLE workout_records (
    id             uuid        NOT NULL PRIMARY KEY,
    workout_day_id uuid        NOT NULL,
    exercise_id    uuid        NOT NULL,
    notes          text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id)    REFERENCES exercises(id)    ON DELETE CASCADE,
    UNIQUE (workout_day_id, exercise_id)
);

CREATE INDEX idx_workout_records_exercise_id ON workout_records(exercise_id);

CREATE TABLE workout_sets (
    id                uuid        NOT NULL PRIMARY KEY,
    workout_record_id uuid        NOT NULL,
    reps              integer     NOT NULL,
    sub_reps          integer     NOT NULL DEFAULT 0,
    weight            numeric     NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_record_id) REFERENCES workout_records(id) ON DELETE CASCADE,
    CHECK (reps     >= 0),
    CHECK (sub_reps >= 0),
    CHECK (weight   >= 0)
);

CREATE INDEX idx_workout_sets_workout_record_id ON workout_sets(workout_record_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workout_days_updated_at
    BEFORE UPDATE ON workout_days
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workout_records_updated_at
    BEFORE UPDATE ON workout_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workout_sets_updated_at
    BEFORE UPDATE ON workout_sets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
