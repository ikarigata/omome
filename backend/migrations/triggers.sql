-- updated_at の自動更新トリガ（SQLite / Turso）。
--
-- PostgreSQL では BEFORE UPDATE トリガ + plpgsql で updated_at を now() に更新していたが、
-- drizzle-kit は SQLite のトリガを生成しないため、ここに手書きで定義し
-- `db:push` 後に migrate.sh（apply-triggers.ts）で適用する。
--
-- タイムスタンプは schema.ts の DEFAULT と同形式（ISO8601 UTC, ミリ秒 + 末尾 Z）。
-- CREATE TRIGGER IF NOT EXISTS で冪等にしているので再適用しても安全。
-- 対象は updated_at を持つテーブルのみ（muscle_groups は created_at のみのため対象外）。
--
-- WHEN NEW.updated_at = OLD.updated_at のガード:
--   AFTER UPDATE トリガが同一テーブルを UPDATE するため、recursive_triggers が
--   有効だと無限再帰し得る。アプリは updated_at を明示更新しない（DB 管理）ので、
--   ユーザー由来の UPDATE では必ず NEW = OLD となりトリガが1回発火する。トリガ内の
--   UPDATE は updated_at を変更するため NEW ≠ OLD となり、再帰がそこで止まる。

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
