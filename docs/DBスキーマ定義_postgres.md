-- =============================================================================
-- omome データベース定義 (PostgreSQL / Neon 向け)
-- =============================================================================
--
-- このファイルは PostgreSQL (Neon) 用のスキーマ定義です。
-- 旧 SQLite/D1 版を PostgreSQL へ書き直し、さらに認証基盤(Cognito)導入に伴う
-- users テーブルの変更を反映しています。
--
-- 【設計方針】
--   1. FK に ON DELETE CASCADE を付与（親削除時に子を自動削除）
--   2. JOIN / 絞り込みに使う FK カラムへインデックスを付与
--   3. データ整合性のための CHECK 制約・UNIQUE 制約を追加
--   4. updated_at を UPDATE 時に自動更新するトリガーを追加
--
-- 【PostgreSQL / Neon 固有の前提】
--   - 主キーは uuid 型。値はアプリケーション側で生成して INSERT する
--     （クライアント生成ID方式。冪等性確保のため DB側DEFAULT は付けない）
--   - タイムスタンプは timestamptz 型（UTC基準で運用）
--   - is_primary は boolean 型
--   - 認証は Amazon Cognito が担当。users.password_hash は持たず、
--     Cognito の sub を cognito_sub 列で対応づける
--   - users 行は Cognito の Post Confirmation トリガー（専用Lambda）で作成する
--     （lazy provisioning は採用しない）
--   - email は nullable（email クレーム未取得でも行作成できるようにするため）。
--     UNIQUE は維持（PostgreSQL では NULL は重複扱いされないため複数行で NULL 可）
-- =============================================================================


-- =============================================================================
-- users : ユーザー
-- -----------------------------------------------------------------------------
-- トレーニングを実施する主体。複数のトレーニング日・種目を保持する。
-- 認証情報(パスワード等)は Cognito が保持し、本テーブルはアプリ内のユーザー実体
-- (外部キーの参照先)＋プロフィールを保持する。
-- =============================================================================
CREATE TABLE users (
    id          uuid        NOT NULL PRIMARY KEY,                 -- ID（UUID。アプリ側で生成）
    cognito_sub text        NOT NULL UNIQUE,                      -- Cognito の sub（認証との対応づけキー。重複不可）
    name        text        NOT NULL,                             -- 氏名・表示名
    email       text        UNIQUE,                               -- メールアドレス（表示/JOIN用途でDBにも保持。重複不可。nullable: email クレーム未取得でも行作成可能にするため）
    created_at  timestamptz NOT NULL DEFAULT now(),               -- 作成日時（UTC）
    updated_at  timestamptz NOT NULL DEFAULT now()                -- 更新日時（UTC）
);

-- cognito_sub での解決（毎リクエストの sub → users.id 解決）を高速化
-- ※ UNIQUE 制約により自動でインデックスが作成されるため、専用インデックスは不要。


-- =============================================================================
-- muscle_groups : 部位（マスタ）
-- -----------------------------------------------------------------------------
-- トレーニングで鍛えられる体の部位。胸/肩/背中/腕/腹/脚/その他 の7区分。
-- マスタなので名称の重複を禁止する。
-- =============================================================================
CREATE TABLE muscle_groups (
    id         uuid        NOT NULL PRIMARY KEY,                  -- ID（UUID。アプリ側で生成）
    name       text        NOT NULL UNIQUE,                       -- 部位名（重複不可。胸/肩/背中/腕/腹/脚/その他）
    created_at timestamptz NOT NULL DEFAULT now()                 -- 作成日時（UTC）
);


-- =============================================================================
-- exercises : トレーニング種目（エクササイズ）
-- -----------------------------------------------------------------------------
-- ユーザーごとに登録するトレーニング種目。1つ以上の部位を鍛える
-- （対象部位は中間テーブル exercise_muscle_groups で管理）。
-- =============================================================================
CREATE TABLE exercises (
    id          uuid        NOT NULL PRIMARY KEY,                 -- ID（UUID。アプリ側で生成）
    user_id     uuid        NOT NULL,                             -- 所有ユーザーID（→ users.id）
    name        text        NOT NULL,                             -- 種目名
    description text,                                             -- 説明（任意）
    created_at  timestamptz NOT NULL DEFAULT now(),               -- 作成日時（UTC）
    updated_at  timestamptz NOT NULL DEFAULT now(),               -- 更新日時（UTC）

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE  -- ユーザー削除時に種目も削除
);

-- user_id での絞り込み（ユーザーの種目一覧取得）を高速化
CREATE INDEX idx_exercises_user_id ON exercises(user_id);


-- =============================================================================
-- exercise_muscle_groups : 種目×部位（中間テーブル）
-- -----------------------------------------------------------------------------
-- 種目と部位の多対多を表す。is_primary でメイン部位/サブ部位を区別する。
--   - 同一種目に同一部位を重複登録できない（UNIQUE）
--   - メイン部位は1種目につき1つまで（後述の部分ユニークインデックスで担保）
-- =============================================================================
CREATE TABLE exercise_muscle_groups (
    id              uuid    NOT NULL PRIMARY KEY,                 -- ID（UUID。アプリ側で生成）
    exercise_id     uuid    NOT NULL,                             -- 種目ID（→ exercises.id）
    muscle_group_id uuid    NOT NULL,                             -- 部位ID（→ muscle_groups.id）
    is_primary      boolean NOT NULL DEFAULT false,              -- メイン部位フラグ（false=サブ, true=メイン）

    FOREIGN KEY (exercise_id)     REFERENCES exercises(id)      ON DELETE CASCADE,  -- 種目削除時に紐付けも削除
    FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id) ON DELETE CASCADE,  -- 部位削除時に紐付けも削除

    UNIQUE (exercise_id, muscle_group_id)                       -- 同一種目に同一部位の重複登録を禁止
);

-- 「メイン部位(is_primary=true)は1種目につき1つまで」を担保する部分ユニークインデックス
-- （WHERE 句付きインデックスにより、is_primary=true の行だけ exercise_id の一意性を強制）
CREATE UNIQUE INDEX idx_emg_one_primary_per_exercise
    ON exercise_muscle_groups(exercise_id)
    WHERE is_primary;

-- 部位側からの逆引き（この部位を鍛える種目一覧）を高速化
CREATE INDEX idx_emg_muscle_group_id ON exercise_muscle_groups(muscle_group_id);


-- =============================================================================
-- workout_days : トレーニング日
-- -----------------------------------------------------------------------------
-- ユーザーが特定の日に行うトレーニング全体。複数の実績(workout_records)を持つ。
-- =============================================================================
CREATE TABLE workout_days (
    id         uuid        NOT NULL PRIMARY KEY,                  -- ID（UUID。アプリ側で生成）
    user_id    uuid        NOT NULL,                              -- 実施ユーザーID（→ users.id）
    date       date        NOT NULL DEFAULT CURRENT_DATE,         -- 実施日（YYYY-MM-DD）
    title      text,                                              -- タイトル（任意）
    notes      text,                                              -- メモ（任意）
    created_at timestamptz NOT NULL DEFAULT now(),                -- 作成日時（UTC）
    updated_at timestamptz NOT NULL DEFAULT now(),                -- 更新日時（UTC）

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE  -- ユーザー削除時にトレーニング日も削除
);

-- user_id での絞り込み（ユーザーのトレーニング日一覧）を高速化
CREATE INDEX idx_workout_days_user_id ON workout_days(user_id);


-- =============================================================================
-- workout_records : トレーニング実績
-- -----------------------------------------------------------------------------
-- 1つのトレーニング日に紐づき、1つの種目を対象とする実績。
-- 複数のセット(workout_sets)で構成される。
-- =============================================================================
CREATE TABLE workout_records (
    id             uuid        NOT NULL PRIMARY KEY,              -- ID（UUID。アプリ側で生成）
    workout_day_id uuid        NOT NULL,                          -- トレーニング日ID（→ workout_days.id）
    exercise_id    uuid        NOT NULL,                          -- 種目ID（→ exercises.id）
    notes          text,                                          -- 備考（任意）
    created_at     timestamptz NOT NULL DEFAULT now(),            -- 作成日時（UTC）
    updated_at     timestamptz NOT NULL DEFAULT now(),            -- 更新日時（UTC）

    FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE CASCADE,  -- トレーニング日削除時に実績も削除
    FOREIGN KEY (exercise_id)    REFERENCES exercises(id)    ON DELETE CASCADE,  -- 種目削除時に実績も削除

    UNIQUE (workout_day_id, exercise_id)                       -- 1トレーニング日につき同一種目は1レコードまで
);

-- トレーニング日ごとの実績取得は、UNIQUE (workout_day_id, exercise_id) の
-- 自動生成インデックスが先頭カラム workout_day_id を含むため、専用インデックスは不要。
-- 種目ごとの実績取得（統計・進捗）を高速化
CREATE INDEX idx_workout_records_exercise_id ON workout_records(exercise_id);


-- =============================================================================
-- workout_sets : トレーニングセット
-- -----------------------------------------------------------------------------
-- 1つの実績に紐づく個々のセット。重量とレップ数で構成される。
-- ボリューム = (reps + sub_reps) * weight は DB に持たず、将来の統計実装時に
-- アプリ側で算出する。
-- =============================================================================
CREATE TABLE workout_sets (
    id                uuid        NOT NULL PRIMARY KEY,           -- ID（UUID。アプリ側で生成）
    workout_record_id uuid        NOT NULL,                       -- 実績ID（→ workout_records.id）
    reps              integer     NOT NULL,                       -- レップ数（挙上回数）
    sub_reps          integer     NOT NULL DEFAULT 0,             -- 追加レップ数
    weight            numeric     NOT NULL,                       -- 重量(kg)
    -- volume（ボリューム）は DB に持たない。将来の統計実装時にアプリ側で
    -- (reps + sub_reps) * weight として算出する。
    created_at        timestamptz NOT NULL DEFAULT now(),         -- 作成日時（UTC）
    updated_at        timestamptz NOT NULL DEFAULT now(),         -- 更新日時（UTC）

    FOREIGN KEY (workout_record_id) REFERENCES workout_records(id) ON DELETE CASCADE,  -- 実績削除時にセットも削除

    CHECK (reps     >= 0),                                       -- レップ数は負数不可
    CHECK (sub_reps >= 0),                                       -- 追加レップ数は負数不可
    CHECK (weight   >= 0)                                        -- 重量は負数不可
);

-- 実績ごとのセット取得を高速化
CREATE INDEX idx_workout_sets_workout_record_id ON workout_sets(workout_record_id);


-- =============================================================================
-- updated_at 自動更新トリガー
-- -----------------------------------------------------------------------------
-- PostgreSQL では共通のトリガー関数を1つ定義し、各テーブルの BEFORE UPDATE で
-- 呼び出す。BEFORE UPDATE で NEW.updated_at を書き換えるため、SQLite版のような
-- 追加 UPDATE（再帰の懸念）は発生しない。
-- =============================================================================

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