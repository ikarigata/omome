-- =============================================================================
-- omome データベース定義 (SQLite / Turso 向け)
-- =============================================================================
--
-- このファイルは SQLite (libSQL / Turso) 用のスキーマ定義であり、DB定義の正。
-- 実体は Drizzle スキーマ（backend/src/db/schema.ts）と updated_at トリガ
-- （backend/migrations/triggers.sql）。本書はその有効な SQL 版の正本。
-- 旧 Neon/PostgreSQL 版からの移行経緯は docs/omome_Turso移行設計書.md を参照。
--
-- 【設計方針】
--   1. FK に ON DELETE CASCADE を付与（親削除時に子を自動削除）
--   2. JOIN / 絞り込みに使う FK カラムへインデックスを付与
--   3. データ整合性のための CHECK 制約・UNIQUE 制約を追加
--   4. updated_at を UPDATE 時に自動更新するトリガーを追加
--
-- 【SQLite / Turso 固有の前提】
--   - 主キーは TEXT（UUID 文字列）。値はアプリ側で生成して INSERT する
--     （クライアント生成ID方式。冪等性確保のため DB側DEFAULT は付けない）。
--     SQLite に uuid 型は無いため TEXT で保持する。
--   - タイムスタンプは TEXT に ISO8601 UTC（ミリ秒 + 末尾 Z）で保存する。
--     DEFAULT は strftime('%Y-%m-%dT%H:%M:%fZ','now')。timestamptz は無いが、
--     この形式は JS の new Date() が解釈でき、辞書順 = 時系列順になる。
--   - is_primary は INTEGER（0/1。Drizzle の integer mode:'boolean'）。
--   - weight は TEXT（小数の桁を厳密保持。アプリが String()/Number() で往復）。
--   - date（workout_days.date）は TEXT（YYYY-MM-DD）。
--   - 認証は Amazon Cognito が担当。users.password_hash は持たず、
--     Cognito の sub を cognito_sub 列で対応づける。
--   - users 行は Cognito の Post Confirmation トリガー（専用Lambda）で作成する。
--   - email は nullable（email クレーム未取得でも行作成できるようにするため）。
--     UNIQUE は維持（SQLite でも NULL は重複扱いされないため複数行で NULL 可）。
--
-- 【⚠️ 外部キー強制（ON DELETE CASCADE の前提）】
--   SQLite は接続ごとに PRAGMA foreign_keys が既定 OFF で、OFF だと
--   ON DELETE CASCADE が機能せず子行が孤立する。アプリは exercise / workout_day
--   等の削除で子のカスケード削除に依存している。
--   - 本番 Turso: foreign_keys は既定 ON（サーバ側）なのでカスケードは機能する。
--   - ローカルの SQLite ファイル / インメモリ等で検証する場合は、必要に応じて
--     接続後に `PRAGMA foreign_keys = ON;` を実行すること。
-- =============================================================================


-- =============================================================================
-- users : ユーザー
-- =============================================================================
CREATE TABLE users (
    id          TEXT NOT NULL PRIMARY KEY,                                    -- ID（UUID 文字列。アプリ側で生成）
    cognito_sub TEXT NOT NULL UNIQUE,                                         -- Cognito の sub（認証との対応づけキー。重複不可）
    name        TEXT NOT NULL,                                                -- 氏名・表示名
    email       TEXT UNIQUE,                                                  -- メールアドレス（重複不可。nullable）
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 作成日時（ISO8601 UTC）
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))  -- 更新日時（ISO8601 UTC）
);
-- cognito_sub の UNIQUE で自動インデックスが作られるため専用インデックスは不要。


-- =============================================================================
-- muscle_groups : 部位（マスタ）
-- =============================================================================
CREATE TABLE muscle_groups (
    id         TEXT NOT NULL PRIMARY KEY,                                    -- ID（UUID 文字列。アプリ側で生成）
    name       TEXT NOT NULL UNIQUE,                                         -- 部位名（重複不可。胸/肩/背中/腕/腹/脚/その他）
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))  -- 作成日時（ISO8601 UTC）
);


-- =============================================================================
-- exercises : トレーニング種目（エクササイズ）
-- =============================================================================
CREATE TABLE exercises (
    id          TEXT NOT NULL PRIMARY KEY,                                    -- ID（UUID 文字列。アプリ側で生成）
    user_id     TEXT NOT NULL,                                                -- 所有ユーザーID（→ users.id）
    name        TEXT NOT NULL,                                                -- 種目名
    description TEXT,                                                         -- 説明（任意）
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 作成日時（ISO8601 UTC）
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 更新日時（ISO8601 UTC）

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE              -- ユーザー削除時に種目も削除
);

-- user_id での絞り込み（ユーザーの種目一覧取得）を高速化
CREATE INDEX idx_exercises_user_id ON exercises(user_id);


-- =============================================================================
-- exercise_muscle_groups : 種目×部位（中間テーブル）
-- =============================================================================
CREATE TABLE exercise_muscle_groups (
    id              TEXT    NOT NULL PRIMARY KEY,        -- ID（UUID 文字列。アプリ側で生成）
    exercise_id     TEXT    NOT NULL,                    -- 種目ID（→ exercises.id）
    muscle_group_id TEXT    NOT NULL,                    -- 部位ID（→ muscle_groups.id）
    is_primary      INTEGER NOT NULL DEFAULT 0,          -- メイン部位フラグ（0=サブ, 1=メイン）

    FOREIGN KEY (exercise_id)     REFERENCES exercises(id)      ON DELETE CASCADE,  -- 種目削除時に紐付けも削除
    FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id) ON DELETE CASCADE,  -- 部位削除時に紐付けも削除

    UNIQUE (exercise_id, muscle_group_id)               -- 同一種目に同一部位の重複登録を禁止
);

-- 「メイン部位(is_primary=1)は1種目につき1つまで」を担保する部分ユニークインデックス
-- （bool は INTEGER 格納なので WHERE is_primary = 1）
CREATE UNIQUE INDEX idx_emg_one_primary_per_exercise
    ON exercise_muscle_groups(exercise_id)
    WHERE is_primary = 1;

-- 部位側からの逆引き（この部位を鍛える種目一覧）を高速化
CREATE INDEX idx_emg_muscle_group_id ON exercise_muscle_groups(muscle_group_id);


-- =============================================================================
-- workout_days : トレーニング日
-- =============================================================================
CREATE TABLE workout_days (
    id         TEXT NOT NULL PRIMARY KEY,                                    -- ID（UUID 文字列。アプリ側で生成）
    user_id    TEXT NOT NULL,                                                -- 実施ユーザーID（→ users.id）
    date       TEXT NOT NULL,                                                -- 実施日（YYYY-MM-DD。アプリ側で明示セット）
    title      TEXT,                                                         -- タイトル（任意）
    notes      TEXT,                                                         -- メモ（任意）
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 作成日時（ISO8601 UTC）
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 更新日時（ISO8601 UTC）

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE             -- ユーザー削除時にトレーニング日も削除
);

-- user_id での絞り込み（ユーザーのトレーニング日一覧）を高速化
CREATE INDEX idx_workout_days_user_id ON workout_days(user_id);


-- =============================================================================
-- workout_records : トレーニング実績
-- =============================================================================
CREATE TABLE workout_records (
    id             TEXT NOT NULL PRIMARY KEY,                                    -- ID（UUID 文字列。アプリ側で生成）
    workout_day_id TEXT NOT NULL,                                                -- トレーニング日ID（→ workout_days.id）
    exercise_id    TEXT NOT NULL,                                                -- 種目ID（→ exercises.id）
    notes          TEXT,                                                         -- 備考（任意）
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 作成日時（ISO8601 UTC）
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 更新日時（ISO8601 UTC）

    FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE CASCADE,  -- トレーニング日削除時に実績も削除
    FOREIGN KEY (exercise_id)    REFERENCES exercises(id)    ON DELETE CASCADE,  -- 種目削除時に実績も削除

    UNIQUE (workout_day_id, exercise_id)                                       -- 1トレーニング日につき同一種目は1レコードまで
);

-- workout_day_id は UNIQUE(workout_day_id, exercise_id) の自動インデックス先頭列で代替。
-- 種目ごとの実績取得（統計・進捗）を高速化
CREATE INDEX idx_workout_records_exercise_id ON workout_records(exercise_id);


-- =============================================================================
-- workout_sets : トレーニングセット
-- -----------------------------------------------------------------------------
-- volume = reps * weight は DB に持たず、必要時にアプリ側で算出する。
-- =============================================================================
CREATE TABLE workout_sets (
    id                TEXT    NOT NULL PRIMARY KEY,                                  -- ID（UUID 文字列。アプリ側で生成）
    workout_record_id TEXT    NOT NULL,                                              -- 実績ID（→ workout_records.id）
    reps              INTEGER NOT NULL,                                              -- レップ数（挙上回数）
    weight            TEXT    NOT NULL,                                              -- 重量(kg)。小数の桁を厳密保持するため TEXT
    position          INTEGER NOT NULL DEFAULT 0,                                    -- 実績内の表示順（ドラッグ並べ替えで永続化。同値は created_at で安定ソート）
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 作成日時（ISO8601 UTC）
    updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 更新日時（ISO8601 UTC）

    FOREIGN KEY (workout_record_id) REFERENCES workout_records(id) ON DELETE CASCADE,  -- 実績削除時にセットも削除

    CHECK (reps >= 0),                                                              -- レップ数は負数不可
    CHECK (CAST(weight AS REAL) >= 0)                                               -- 重量は負数不可（TEXT 格納のため数値比較は CAST）
);

-- 実績ごとのセット取得を高速化
CREATE INDEX idx_workout_sets_workout_record_id ON workout_sets(workout_record_id);


-- =============================================================================
-- updated_at 自動更新トリガー
-- -----------------------------------------------------------------------------
-- SQLite には plpgsql の BEFORE UPDATE 関数が無いため、テーブルごとに AFTER UPDATE
-- トリガで updated_at を更新する。AFTER UPDATE が同一テーブルを UPDATE するので、
-- recursive_triggers 有効時の無限再帰を避けるため WHEN ガードを付ける：
--   アプリは updated_at を明示更新しない（DB 管理）ので、ユーザー由来の UPDATE では
--   必ず NEW.updated_at = OLD.updated_at となり1回だけ発火する。トリガ内 UPDATE は
--   updated_at を変えるため次は NEW ≠ OLD となり再帰が止まる。
-- 実体は backend/migrations/triggers.sql（db:triggers で適用）。
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_exercises_updated_at
AFTER UPDATE ON exercises FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE exercises SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workout_days_updated_at
AFTER UPDATE ON workout_days FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE workout_days SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workout_records_updated_at
AFTER UPDATE ON workout_records FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE workout_records SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workout_sets_updated_at
AFTER UPDATE ON workout_sets FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE workout_sets SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
