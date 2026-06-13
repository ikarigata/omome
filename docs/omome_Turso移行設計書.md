# omome Turso 移行設計書（Neon/Postgres → Turso/SQLite + 東京リージョン回帰）

> ステータス: **計画段階（未着手）**。本書は移行の設計と作業計画の正。着手前に方針（[§10 決定事項 / 残課題](#10-決定事項--残課題)）を確定してから実装に入る。
> 関連: [[deploy-migrate-before-signup]] / [[neon-no-tokyo-region]] / [[set-save-keep-and-retry]] / [[migrate-aborts-on-data-loss]]

> 🟢 **前提（確定）**: 現在はお試しデプロイ段階で、**既存データは全て破棄してよい**（DB の実データも Cognito のユーザー情報も含む）。したがって **データ移行は行わない**。Neon は躊躇なく destroy、Cognito ユーザープールも作り直し / 全削除して構わない。これにより移行は「新スキーマで作り直す」だけの単純作業になる。

## 0. 目的とゴール

1. DB を **Neon（PostgreSQL, シンガポール）→ Turso（libSQL/SQLite, 東京 `nrt`）** に移行する。
2. AWS の app Lambda + API Gateway を **シンガポール → 東京（`ap-northeast-1`）に回帰**させ、[[neon-no-tokyo-region]] で導入した2リージョン構成を解消する（DB が東京に来るので越境の理由が消える）。
3. Postgres 前提の処理（型・関数・トリガ・エラーコード・ドライバ）を **SQLite 対応に書き換える**。挙動（特に冪等性の3ルール）は維持する。

### 非ゴール / 据え置き
- お気に入り・テーマ切替はスコープ外（統計は移行後に別途実装済み）。
- **データ移行はしない**（既存データ破棄可のため）。マスタ（`muscle_groups`）は seed で投入。
- **【決定】Turso 接続は HTTPS リモート（`libsql://` over HTTPS）のみ**。埋め込みレプリカ（embedded replica）は使わない。東京同居でのレイテンシ改善をまず確認し、要件を満たさなければ次段で検討する。

### 重大リスク（先に合意すべき点）
- **Turso には公式 Terraform Provider が無い**。本書では **Turso DB は Terraform 管理外**とし、`turso` CLI で作成、接続情報（URL + auth token）を Terraform 変数 / GitHub Secrets 経由で Lambda に注入する方針を採る（[§5](#5-インフラinfra)）。
- **タイムスタンプの文字列表現が変わる**（`timestamptz` → SQLite TEXT）。フロントの `new Date()` 解釈とテキスト安定ソートに影響するため、ISO8601 UTC（末尾 `Z`）に正規化して互換を保つ（[§4.3](#43-タイムスタンプ-timestamptz--text-iso8601-最重要)）。
- データ破棄可なので Neon 撤去・Cognito リセットの順序リスクは消えた。Neon Provider は固定運用中なので `terraform init -upgrade` は引き続き禁止（撤去 apply 時も含む）。

---

## 1. Postgres 特有機能の棚卸し（置換対象の全リスト）

> ⚠️ ユーザー要望: `gen_random_uuid` のような PG 特有機能は取りこぼさず洗い出して置換する。以下が全件。

| # | PG 特有要素 | 使用箇所 | SQLite/libSQL での置換 |
|---|---|---|---|
| 1 | ドライバ `@neondatabase/serverless` + `drizzle-orm/neon-http` | `backend/src/db/client.ts`, `backend/scripts/seed.ts`, `cognito-trigger/src/postConfirmation.ts` | `@libsql/client/web` + **`drizzle-orm/libsql/web`**（`createClient({ url, authToken })`）。Lambda は pure-JS の web サブパス必須（[§4.6](#46-lambda-では-web-サブパス必須)） |
| 2 | スキーマ DSL `drizzle-orm/pg-core`（`pgTable`） | `backend/src/db/schema.ts` | `drizzle-orm/sqlite-core`（`sqliteTable`） |
| 3 | `uuid` 型 | 全テーブルの id / 外部キー | `text`（クライアント生成 UUID をそのまま格納。SQLite に uuid 型は無い） |
| 4 | `timestamp({ withTimezone: true })` = `timestamptz` | created_at / updated_at 全箇所 | `text`（ISO8601 UTC。[§4.3](#43-タイムスタンプ-timestamptz--text-iso8601-最重要)） |
| 5 | `date({ mode:'string' })` | `workout_days.date` | `text`（`YYYY-MM-DD`。SQLite に date 型は無いが文字列比較で範囲検索は成立） |
| 6 | `boolean` | `exercise_muscle_groups.is_primary` | `integer({ mode:'boolean' })`（0/1 格納、drizzle が bool に変換） |
| 7 | `numeric` | `workout_sets.weight` | `text`（小数の桁を厳密保持。既存コードが `String()`/`Number()` 変換済みで親和的） |
| 8 | `defaultNow()` = `now()` | created_at / updated_at の DEFAULT | `default(sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\`)`（ISO8601 UTC を返す） |
| 9 | **`updated_at` の BEFORE UPDATE トリガ（plpgsql）** | DBスキーマ定義 | SQLite の `CREATE TRIGGER ... AFTER UPDATE` で同等を再現（drizzle-kit は生成しないので手書き SQL。[§4.4](#44-updated_at-自動更新)） |
| 10 | **部分 UNIQUE インデックス** `WHERE is_primary = true` | `idx_emg_one_primary_per_exercise` | SQLite も部分インデックス対応。`WHERE is_primary = 1`（bool が整数になるため右辺を 1 に） |
| 11 | エラーコード `23505`（unique_violation） | `backend/src/middleware/error.ts: isUniqueViolation` | libSQL の `SQLITE_CONSTRAINT_UNIQUE` **および** `SQLITE_CONSTRAINT_PRIMARYKEY`（[§4.5](#45-冪等性のかなめユニーク制約違反の検知)） |
| 12 | `ON CONFLICT (...) DO NOTHING` / `.onConflictDoNothing()` | `seed.ts`, `cognito-trigger`（生 SQL） | SQLite も `ON CONFLICT ... DO NOTHING` 対応。drizzle の `.onConflictDoNothing()` はそのまま動く |
| 13 | `.returning()` | 各 repository | SQLite 3.35+ / libSQL 対応。そのまま |
| 14 | `db.batch([...])`（neon-http はインタラクティブ tx 非対応の代替） | `exercisesRepository`, `workoutSetsRepository` | libSQL も `db.batch` 対応。型を `BatchItem<'pg'>` → `BatchItem<'sqlite'>` に。**libSQL は本物の `db.transaction` も使える**ので将来簡素化可（今回は batch 維持で差分最小化） |
| 15 | 接続文字列2系統 `DATABASE_URL`(pooled) / `DIRECT_URL`(direct) | infra / migrate.sh / drizzle.config | Turso は単一エンドポイント。`TURSO_DATABASE_URL`(`libsql://...`) + `TURSO_AUTH_TOKEN` の1系統に統合 |

**`gen_random_uuid` について**: 現行設計は「ID に DB DEFAULT を付けない（必ず明示 INSERT）」方針（CLAUDE.md）。アプリ生成は `crypto.randomUUID()`（フロント／`cognito-trigger`）。よって **`gen_random_uuid()` の実利用は無い**。schema / migrations / seed を grep して残存ゼロを移行 PR で証跡化する（取りこぼし防止の明示チェック項目）。

---

## 2. 影響範囲マップ（触るファイル）

### backend
- `src/db/client.ts` — ドライバ差し替え（#1）
- `src/db/schema.ts` — `sqlite-core` へ全面書き換え（#2-#10）
- `src/middleware/error.ts` — `isUniqueViolation` を libSQL エラーに対応（#11）
- `src/repositories/*.ts` — `BatchItem<'pg'>` → `<'sqlite'>`（#14）。クエリ本体（select/insert/update/where/orderBy）は drizzle 抽象なのでほぼ無改修。`workout_sets` の安定ソート `asc(createdAt)` は TEXT 昇順で従来同等。
- `drizzle.config.ts` — `dialect: 'turso'`、`dbCredentials: { url, authToken }`
- `scripts/seed.ts` — ドライバ差し替え（#1, #12）
- `package.json` — 依存を `@neondatabase/serverless` 削除、`@libsql/client` 追加
- `src/**/__tests__` — `23505` を使うエラーモック、タイムスタンプ期待値の確認（[§7](#7-テスト)）

### cognito-trigger
- `src/postConfirmation.ts` — `neon` 生 SQL → `@libsql/client` の `execute`（#1, #12）
- `src/__tests__/postConfirmation.test.ts` — モック対象の差し替え

### infra
- `neon.tf` — 削除
- `providers.tf` — `neon` provider 削除、`aws.compute` alias を撤去（東京 default に統一）
- `locals.tf` — Neon 接続文字列構築ロジック削除、Turso 接続値に置換
- `variables.tf` — `neon_api_key` / `compute_region` 削除、`turso_database_url` / `turso_auth_token` 追加
- `lambda.tf` — 両 Lambda の `provider = aws.compute` 撤去（東京 default に）、env を Turso 値に
- `api_gateway.tf` — `provider = aws.compute` 撤去（東京へ）。**API Gateway のリージョンが変わる = invoke URL（ドメイン）が変わる**点に注意（CloudFront オリジン / フロント API ベース URL / `cors_origin` の更新が要る）
- `outputs.tf` / `github_oidc.tf` — `neon_direct_url` 等の Neon 出力削除、CD ロールのリージョン参照・権限見直し
- `terraform.tf` — `required_providers` から `neon` 削除
- `cognito.tf` — **変更なし（流用）**。issuer / Client ID を維持しフロント env を不変に保つ。既存ユーザーは破棄可だが、プール自体は作り直さない

### スクリプト / ドキュメント
- `migrate.sh` — `DIRECT_URL` 取得を廃止し Turso 向けに。`db:push` 後に **トリガ作成 SQL の適用**ステップを追加
- `deploy.sh` — `--region` 明示（compute_region）を東京に統一、Turso 接続値の受け渡し
- `docs/DBスキーマ定義_postgres.md` — `DBスキーマ定義_sqlite.md` を新設 or 本書で読み替え（**スキーマの正を SQLite に更新**）
- `docs/omome_バックエンド設計書.md` / `omome_モノレポ構成設計書.md` / `omome_実装TODO.md` — Neon/Postgres 記述を Turso/SQLite に更新
- `CLAUDE.md` — DB・接続・リージョンの記述を更新
- メモリ: [[neon-no-tokyo-region]] は陳腐化 → 東京回帰の経緯に書き換え。[[migrate-aborts-on-data-loss]] は drizzle-kit push の挙動として概ね有効だが Turso 版の注意に更新。

---

## 3. ドライバ移行の具体（#1, #14）

### client.ts
```ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})
export const db = drizzle({ client, schema })
export type DB = typeof db
```
- ハンドラ外初期化でウォームスタート再利用は従来どおり。
- **batch / transaction**: libSQL は `db.batch([...])`（暗黙トランザクション）も `db.transaction(async tx => ...)`（インタラクティブ）も対応。差分最小化のため今回は既存の `db.batch` を踏襲し、`BatchItem<'pg'>` を `BatchItem<'sqlite'>` に置換するのみとする。

### cognito-trigger
`neon` のタグ付きテンプレート `sql\`...\`` を `client.execute({ sql, args })` に置換:
```ts
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! })
// ...
await client.execute({
  sql: 'INSERT INTO users (id, cognito_sub, name, email) VALUES (?, ?, ?, ?) ON CONFLICT (cognito_sub) DO NOTHING',
  args: [id, sub, name, email ?? null],
})
```
> 注: created_at/updated_at は DEFAULT に任せる（明示セットしない）方針を維持。

---

## 4. スキーマ移行の具体（#2-#11）

### 4.1 型対応の最終形
```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const tsDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`

// 例: users
export const users = sqliteTable('users', {
  id: text('id').notNull().primaryKey(),
  cognitoSub: text('cognito_sub').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  createdAt: text('created_at').notNull().default(tsDefault),
  updatedAt: text('updated_at').notNull().default(tsDefault),
})
```
- `is_primary`: `integer('is_primary', { mode: 'boolean' }).notNull().default(false)`
- `reps` / `position`: `integer(...)`（従来どおり）
- `weight`: `text('weight').notNull()`（repository は既に `String(weight)` 挿入 / `Number(row.weight)` 取得なので無改修）
- `date`: `text('date').notNull()`

### 4.2 インデックス（#10 部分 UNIQUE）
```ts
uniqueIndex('idx_emg_one_primary_per_exercise')
  .on(table.exerciseId)
  .where(sql`${table.isPrimary} = 1`)  // bool→int のため = true ではなく = 1
```
他のインデックス（複合 UNIQUE、通常 index）はそのまま SQLite で機能する。

### 4.3 タイムスタンプ `timestamptz` → TEXT ISO8601（最重要）
- **方針**: TEXT に **ISO8601 UTC（ミリ秒 + 末尾 `Z`）**で保存する。`strftime('%Y-%m-%dT%H:%M:%fZ','now')` が `2026-06-11T04:14:00.123Z` を返す。
  - 理由: ①JS `new Date(str)` がそのまま解釈可能 → フロント無改修、②辞書順 = 時系列順 → `workout_sets` の `asc(createdAt)` 安定ソートが従来同等、③shared DTO は `createdAt: z.string()` で形は不変。
- **避ける選択肢**: SQLite 既定の `CURRENT_TIMESTAMP`（`2026-06-11 04:14:00`、`T`/`Z`無し・ミリ秒無し）。JS の解釈がローカルTZ扱いになりズレる & 既存テスト期待値（`...T...Z`）と食い違う。必ず `strftime` 版を使う。
- 注意: libSQL の `datetime('now')` 系は UTC を返す（ローカルTZの概念を持たない）。明示で `Z` を付ける本方式で UTC 統一の原則（CLAUDE.md）と整合。

### 4.4 `updated_at` 自動更新（#9）
- drizzle-kit はトリガを生成しない。**手書き SQL**を `backend/migrations/` に置き、`migrate.sh` の `db:push` 後に流す。テーブルごとに:
```sql
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;
```
対象: `users` / `exercises` / `workout_days` / `workout_records` / `workout_sets`（`muscle_groups` は updated_at 無し）。
- **【決定】トリガ方式を採用**（DB管理の原則を維持）。`$onUpdate`（アプリ層）案は不採用。トリガ作成 SQL は `CREATE TRIGGER IF NOT EXISTS` で冪等にし、`migrate.sh` の `db:push` 後に適用する。

### 4.5 冪等性のかなめ：ユニーク制約違反の検知（#11）
現行は PG の `23505` 一本で「PK 重複」も「UNIQUE インデックス重複」も拾えていた。

**⚠️ 実装時の重要な発見（実機 probe 済み）**: libSQL クライアントは制約違反時、**`code` には汎用の `'SQLITE_CONSTRAINT'`** を入れ、**拡張結果コードは `rawCode`（数値）** に入れる（local パス）。つまり当初案の「`code === 'SQLITE_CONSTRAINT_UNIQUE'` を見る」では **一切マッチせず冪等性が壊れる**。実測値:
- PK 重複: `code='SQLITE_CONSTRAINT'`, `rawCode=1555`, message=`"UNIQUE constraint failed: t.id"`
- UNIQUE 重複: `code='SQLITE_CONSTRAINT'`, `rawCode=2067`, message=`"UNIQUE constraint failed: t.v"`
- SQLite は **PK 重複も "UNIQUE constraint failed" と表現**する（PRIMARY KEY と書かない）。
- remote（Turso/hrana）では `code` に拡張コード文字列が入る経路もあるため、両対応する。

```ts
const SQLITE_PK_VIOLATION = 1555      // SQLITE_CONSTRAINT_PRIMARYKEY
const SQLITE_UNIQUE_VIOLATION = 2067  // SQLITE_CONSTRAINT_UNIQUE
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; rawCode?: unknown; message?: unknown }
  if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true
  if (e.rawCode === SQLITE_PK_VIOLATION || e.rawCode === SQLITE_UNIQUE_VIOLATION) return true
  if (e.code === 'SQLITE_CONSTRAINT' && typeof e.message === 'string') {
    return /UNIQUE constraint failed/i.test(e.message) // PK 重複もこの文言
  }
  return false
}
```
> **NOT NULL / FOREIGN KEY / CHECK 違反は除外**しなければならない（ID 欠落の NOT NULL 違反などは握りつぶさず 500 として顕在化させる方針）。これらは message が異なる（"NOT NULL constraint failed" 等）ため上記で除外される。
> ここを誤ると冪等性（クライアント生成UUID + 重複→既存返却 200）が壊れる。`workout_records` の `UNIQUE(workout_day_id, exercise_id)` 合流、`workout_sets`/`workout_days`/`exercises` の PK 合流が全て本関数依存。→ **実 libSQL（:memory:）統合テストで全経路を検証済み**（`backend/src/repositories/__tests__/idempotency.integration.test.ts`）。

### 4.6 Lambda では web サブパス必須

> 🟢 **デプロイ後に実害が出た罠**（2026-06-11、移行デプロイ直後）。ログインは出来るがトレーニング日追加など全 API が失敗。app Lambda の CloudWatch ログに `Runtime.ImportModuleError: Cannot find module '@libsql/linux-x64-gnu'`。

`backend/src/db/client.ts` のクライアントを `@libsql/client/web`（pure-JS）にしていても、**drizzle を `drizzle-orm/libsql`（デフォルトエントリ）から import すると、その実体 `driver.cjs` が `require('@libsql/client')`（ネイティブ版）を引き込む**。esbuild はそれをバンドルし、ネイティブ binding `@libsql/linux-x64-gnu` を実行時 require → Lambda 起動クラッシュ。クライアントを web 化しても drizzle 側でネイティブが混入するので無意味。

**正**: drizzle も web サブパスから import する。

```ts
import { createClient } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql/web'   // ← 'drizzle-orm/libsql' ではない
```

`drizzle-orm/libsql/web` は内部で `@libsql/client/web` を使う（`createClient` の I/F は同一）。CLAUDE.md の「Lambda は pure-JS の `@libsql/client/web`」は **drizzle の import 元にも適用**される、と読むこと。

**検証**: ビルド成果物を直接 grep する。`grep -c linux-x64-gnu backend/dist/index.js` が **0**、`require("@libsql/client")`（web 無し）が無いこと。pure-JS スタックの目印として `hrana-client` が含まれていれば OK。`cognito-trigger` は drizzle を使わず `@libsql/client/web` を直接利用するため本問題は起きない（実際サインアップ＝Post Confirmation は移行直後から成功していた）。

---

## 5. インフラ（infra/）

### 5.1 リージョン回帰
- `compute_region` 変数と `aws.compute` provider alias を撤去し、全リソースを `ap-northeast-1`（東京）に統一。`providers.tf` / `lambda.tf` / `api_gateway.tf` の `provider = aws.compute` 行を削除。
- **API Gateway のドメインが変わる**（`*.execute-api.ap-southeast-1` → `ap-northeast-1`）。CloudFront のオリジン、フロントの API ベース URL、`cors_origin` の整合を取る。`outputs.tf` の URL も更新。
- `cognito-trigger` は元々東京（default provider）なので変更なし。Cognito issuer の `var.aws_region` 参照も東京のまま。
- **Cognito ユーザープールは流用**（【決定】）。issuer / Client ID が不変なのでフロントの Amplify 設定 env は変更不要。

### 5.2 Turso のプロビジョニング方針（Terraform 管理外）
- DB 作成は手動/スクリプト（CLI）:
  ```bash
  turso db create omome --location nrt   # 東京
  turso db show omome --url              # libsql://omome-<org>.turso.io
  turso db tokens create omome           # auth token
  ```
- 取得した URL / token を **Terraform 変数**（`turso_database_url` / `turso_auth_token`, `sensitive = true`）に渡し、`lambda.tf` の env に注入。CI/CD では **GitHub Secrets** に保存し、`deploy.sh` / workflow が環境変数で受け渡す。
- `variables.tf`: `neon_api_key`・`compute_region` 削除、上記2変数を追加。`locals.tf` の Neon 接続文字列構築は削除。
- `terraform.tf` の `required_providers` から `neon` を削除。

### 5.3 Neon 撤去（データ破棄可なので単純）
本実装では `neon.tf` / `neon` provider / `aws.compute` alias を**設定から削除済み**。ただし
state にはまだ `neon_*` リソースと `aws.compute` 経由のリソースが残っている。provider を
消した状態で `apply` すると「provider configuration not present」で**失敗する**ため、先に
state から外す必要がある（データ破棄可なので destroy ではなく state rm + 手動削除でよい）:

```bash
cd infra
# 1) Neon を state から除去（provider が無いので destroy ではなく rm）
terraform state rm neon_database.omome neon_role.omome neon_project.main
# 2) Neon コンソールでプロジェクトを手動削除（実データはここで消える。破棄可）
# 3) apply: app Lambda / API GW など aws.compute 配下のリソースは
#    provider alias 消滅で default(東京)へ。リージョン変更は destroy + 再作成になる。
AWS_PROFILE=terraform terraform apply
```
> `aws.compute`→default の付け替えで app Lambda / API Gateway / それらの権限・統合・ルート・
> ステージは**シンガポールで destroy → 東京で再作成**される（ステートレス compute なので問題なし）。
> API Gateway の invoke URL が変わるが、CloudFront のオリジンは
> `aws_apigatewayv2_stage.default.invoke_url` から動的導出のため自動追従する。

---

## 6. データ移行 — **不要**

既存データ（DB 実データ・Cognito ユーザー情報とも）は破棄してよいため、データ移行スクリプトは作らない。新スキーマで作り直し、マスタ（`muscle_groups`）のみ `seed` で投入する。動作確認は新規サインアップからやり直す。

---

## 7. テスト

- 既存ユニットテストは repository をモックしており大半は無改修。要修正:
  - `isUniqueViolation` のテスト（`23505` → `SQLITE_CONSTRAINT_*`）。
  - `cognito-trigger` テスト（`@neondatabase/serverless` モック → `@libsql/client` モック）。
  - タイムスタンプ期待値（`...T..Z` 形式は維持されるので大半そのまま）。
- **新規追加（強く推奨）**: libSQL の **インメモリ DB（`createClient({ url: ':memory:' })`）** を使った repository 統合テスト。冪等性3ルールを実 DB 制約で検証する:
  - クライアント生成UUID 二度押し → 既存返却 200（PK 合流）。
  - `workout_records` の `UNIQUE(day, exercise)` 合流。
  - 部分 UNIQUE（主動筋ちょうど1件）違反の検知。
  - これは現状 Neon 実 DB が要るため CI で出来ていなかった領域を埋める **副次的なメリット**。
- `npm run build -w frontend` も忘れず（[[frontend-build-stricter-than-typecheck]]）。

---

## 8. デプロイ / CD への影響

- `migrate.sh`: `DIRECT_URL` 取得を廃止、`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` を Terraform output（or env）から取得 → `drizzle-kit push` → **トリガ SQL 適用** → seed。[[migrate-aborts-on-data-loss]] の「列削除等で対話停止」は SQLite/Turso でも起こり得るので `--force` or shell 直実行の運用は維持（ただし今回は作り直しなので衝突は出ない）。
- `deploy.sh`: app Lambda の `--region` を東京に。Turso 接続値の env 受け渡し。
- CD（`.github/workflows/cd.yml`）: スキーマ/インフラは従来どおり CD 対象外（手動 `migrate.sh` / `terraform apply`）。Secrets に Turso 値を追加。

---

## 9. 移行手順（推奨シーケンス）

> データ破棄可なので一気に切替えてよい。ダウンタイムやロールバック余地は考慮不要。

1. **Turso 準備**: 東京 `nrt` で `turso db create`、URL/token 取得。GitHub Secrets / tfvars に登録。
2. **コード移行（PR）**: ドライバ・スキーマ・`isUniqueViolation`・seed・cognito-trigger・config を SQLite 対応に。テスト（インメモリ統合含む）green。`gen_random_uuid` 等 PG 特有要素の残存ゼロを grep で確認。
3. **インフラ移行（apply）**: Turso 変数追加、Lambda env 切替、リージョン東京化、Neon リソース削除。`cognito.tf` は必要なら作り直し。
4. **スキーマ適用**: `migrate.sh`（Turso 向け）で push + トリガ + seed。
5. **デプロイ**: app/cognito-trigger Lambda を東京で更新、フロントの API オリジン更新、CloudFront 無効化。
6. **スモークテスト**: 新規サインアップ → 種目作成 → 記録 → カレンダー → セット並べ替え → 冪等性（二度押し）まで確認。**加えて削除のカスケード**（種目削除で実績/セット/部位紐付けが消えるか）を確認する。SQLite の FK は接続既定 OFF だが Turso はサーバ既定 ON のため機能する想定。万一孤立行が残るなら FK 強制を要確認（[[turso-foreign-keys-default-on]]）。
7. **後始末**: 設計書・CLAUDE.md・メモリ（[[neon-no-tokyo-region]] 等）を更新。

---

## 10. 決定事項 / 残課題

### 確定済み
1. **`updated_at` 自動更新 = トリガ方式**（DB管理の原則維持。`$onUpdate` 案は不採用）。→ [§4.4](#44-updated_at-自動更新)
2. **Turso 接続 = HTTPS リモートのみ**（埋め込みレプリカ不使用）。→ [§5.2](#52-turso-のプロビジョニング方針terraform-管理外)
3. **Cognito ユーザープールは流用**（issuer / Client ID を維持し、フロント env を変更しない。データ破棄可だが作り直すメリットが薄いため流用）。→ [§5.1](#51-リージョン回帰)
4. **データ移行なし**（既存データ破棄可）。→ [§6](#6-データ移行--不要)
5. **`weight` = TEXT**（桁厳密保持・既存 `String()`/`Number()` 変換と完全一致。weight でのソート/範囲検索が無いため辞書順の弱点は当たらない）。REAL 案は不採用。→ [§4.1](#41-型対応の最終形)

### 残課題
- なし。実装フェーズに進行可。
