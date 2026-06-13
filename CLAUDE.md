# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクトの状態

全ワークスペース（`shared` / `backend` / `cognito-trigger` / `frontend` / `infra`）が**実装済み**で、AWS（東京 `ap-northeast-1`）+ Turso（libSQL/SQLite, 東京 `nrt`）にデプロイ済みです（旧構成は Neon/PostgreSQL + シンガポール。移行は `docs/omome_Turso移行設計書.md` 参照）。`docs/` 内の設計書（日本語）が引き続き仕様の正（source of truth）であり、設計と実装の両方を同期させて保つこと。決定や挙動が変わったら設計書を更新すること（各設計書に「確定済み / 留保」のセクションがあり、確定事項と未決事項を管理しています）。実装が設計書と食い違っていたら、どちらが正しいかを確認してから直すこと。

**omome** はトレーニング記録アプリで、旧 `lift_log`（Spring Boot/Java + 自前 JWT）を一から作り直すものです。旧リポジトリ（`https://github.com/ikarigata/lift_log.git`）は UI の見た目と業務ロジックの**参考としてのみ**参照します。見た目は踏襲しますが、アーキテクチャ（レイヤ構成・状態管理・API層・認証）は新規に作り直します。旧コードを丸ごと移植しないこと。旧コードは特に冪等性を欠いており、それが新設計の中心的な関心事です。

## 設計書（該当領域を実装する前に読むこと）

- `docs/omome_モノレポ構成設計書.md` — モノレポ構成と `@omome/shared` パッケージ（横断的事項）。
- `docs/omome_バックエンド設計書.md` — バックエンド（ファット Lambda、Hono、Drizzle、Cognito、Turso/libSQL）。
- `docs/omome_Turso移行設計書.md` — Neon/Postgres → Turso/SQLite 移行 + 東京リージョン回帰の設計と実装記録。
- `docs/omome_フロントエンド設計書.md` — フロントエンド（React、Vite、TanStack Query、Amplify Auth）。
- `docs/DBスキーマ定義_sqlite.md` — SQLite/Turso スキーマ（DB定義の正。有効な SQL）。
- `docs/omome_実装TODO.md` — フェーズ分けされた実装チェックリストと、確定済み前提の一覧。

確定済み前提（TODO より）: zod は **v4**。`shared` は **ESM**（module/moduleResolution）。`cognito-trigger` は workspace に含める。Hono + Drizzle + Drizzle Kit。API認可は Cognito の**アクセストークン**を使用。Cognito SDK は **Amplify Auth (Gen2)**。カレンダーAPIは集約レスポンス（月単位、案A）。

## アーキテクチャ（全体像）

npm workspaces のモノレポ。ビルド順序が重要: **`shared` を最初にビルド**し、その後に他がそれを参照する。

```
packages/shared/   @omome/shared — Zod の DTO スキーマ + z.infer 由来の型。リクエスト/レスポンスの形
                   とバリデーションの単一ソースで、フロント・バック双方が参照する。
                   tsc で dist/ にビルド（.js + .d.ts）。利用側は TS ソースではなくビルド成果物を import。
backend/           ファット Lambda: 1関数で全 /api/v1 ルートを Hono で内部ルーティング。Turso(libSQL) 上で Drizzle ORM。
cognito-trigger/   サインアップ確定時に users 行を作成する専用の Post Confirmation Lambda（本体とは別関数）。
frontend/          React + Vite の SPA。サーバ状態は TanStack Query、認証は Amplify (Cognito)。
infra/             Terraform（AWS のみ。Turso は Terraform 管理外で CLI 作成 → 接続情報を変数注入）。
```

### 共有するもの / しないもの（最重要の区別）

`@omome/shared` が持つのは **DTO層のみ**の Zod スキーマと、そこから導出した型です。Drizzle の DB スキーマ（`backend/src/db/schema.ts`）は**共有しません**。DTO はテーブルと1対1で対応しません。例えば DB では `exercises` と `exercise_muscle_groups` 中間テーブルが分かれていますが、API では部位を `muscleGroups: [{ id, isPrimary }]` のネスト配列として公開します。したがって DTO の Zod スキーマは Drizzle から生成せず、`shared` に**手書き**します。同一の Zod スキーマを双方で実行します。フロントは送信前の UX バリデーションに使い、バックは本番の入力バリデーションに使います。フロントにあるからといってバックがバリデーションを省略することはありません。

### バックエンドのレイヤ構成

`handler → router (Hono) → controller → service → repository → db`。認証ミドルウェアが Cognito の `sub` → `users.id`（アプリ生成 UUID）を**毎リクエスト1回、1箇所で**解決します。下位レイヤは常に `users.id` のみを受け取ります。リクエストのボディ/クエリ由来の `userId` は決して信用しないこと。

### すべての書き込みエンドポイントで守るべき3つの横断ルール

1. **クライアント生成 UUID + 冪等性。** フロントが作成リソース（exercises / workout_days / workout_records / workout_sets / exercise_muscle_groups 紐付け）の UUID を `crypto.randomUUID()` で生成してボディに含めます。PK/UNIQUE 重複時（libSQL: `code='SQLITE_CONSTRAINT'` + `rawCode` 1555/2067。`isUniqueViolation` で判定）、バックはエラーにせず**既存行を返す（200）**。クライアント生成 ID と「PK重複→既存返却」は**セットで初めて冪等が成立**します（両方必須）。`workout_records` はさらに `UNIQUE(workout_day_id, exercise_id)` 重複でも合流（upsert）します。新規作成・合流とも **200**（201 は使わない）。
2. すべての操作で**所有権チェック**を行う。対象（作成時は親リソース）が、そのリクエストで解決された `users.id` に属するか検証する。違反は 403（存在を秘匿するなら 404）。これは冪等性とは別で、常に必須です。
3. exercises の**部位配列の制約**: メイン（`isPrimary=true`）ちょうど1件、同一部位の重複不可、空不可（最低1件＝メイン）。shared の Zod（`.superRefine()` 等）で表現し、双方が同一に検証する。レスポンスではメインを先頭に返す。exercise の PUT 時は中間テーブル行を部分更新せず、同一トランザクションで全置換（削除＋再挿入）する。

### その他の規約

- ID は `uuid` 型で **DB の DEFAULT 生成を付けない**（必ず明示 INSERT。ID 欠落は NOT NULL 違反で顕在化）。例外は `users.id` で、これは cognito-trigger Lambda が生成する。
- `updated_at` / `created_at` は **DB 管理**。`created_at` は `DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`、`updated_at` は AFTER UPDATE トリガ（`backend/migrations/triggers.sql`、`db:triggers` で適用）で更新。アプリ側で明示セットしない。タイムスタンプは **TEXT に ISO8601 UTC（末尾 Z）** で保存し全体を UTC 基準で統一。`workout_days.date` は `YYYY-MM-DD` の TEXT。
- `volume = reps * weight` は**保存しない**。必要時にアプリ側で算出する（統計の集約エンドポイント `GET /exercises/:id/progress` もサーバ側で都度算出する）。
- 認証: SPA が Cognito と直接やり取りしてトークン取得。API Gateway の Cognito Authorizer が **アクセストークン**を Lambda 到達前に検証する。表示名の正は `users.name`（アプリ DB）であり、Cognito 属性ではない。フロントはプロフィールをトークンからではなく `GET /users/me` から取得する。
- Turso 接続は単一系統: `TURSO_DATABASE_URL`（`libsql://…`）+ `TURSO_AUTH_TOKEN`。Lambda ランタイムは pure-JS の `@libsql/client/web`（HTTPS リモート、ネイティブ非依存）。ローカルの seed / 統合テストは node の `@libsql/client`（`:memory:` 可）。
- お気に入り（`isFavorite`）、テーマ切替 UI は明示的に**初期スコープ外**（将来追加）。ただしフロントのカラーシステム（セマンティックトークン + CSS変数）は今から用意し、テーマ追加が `[data-theme]` ブロックの追加だけで済むようにしておく。統計画面（`/statistics`）は**実装済み**（種目別の総ボリューム/Max重量/推定1RM 推移を recharts で表示、集約は `GET /exercises/:id/progress`、バックエンド §6.3 / フロント §7）。

## コマンド

ルートの `package.json` がワークスペースをまとめる。`shared` は他のビルド/テストの前提なので、ルートスクリプトは内部で先に `build:shared` を流す。

ルート（リポジトリ直下で実行）:

- `npm run build:shared` / `npm run dev:shared` — `shared` を tsc でビルド（dev は `--watch` 常駐）。フロント/バックを触る前に必ずビルド済みにする。
- `npm run build:backend` / `npm run build:frontend` — `shared` ビルド後に各成果物をビルド。
- `npm run dev:backend` / `npm run dev:frontend` — `shared` を watch しつつ各 dev サーバを起動。
- `npm test` — `shared` をビルドしてから shared / backend / frontend / cognito-trigger の全テストを実行。

各ワークスペース（`-w <name>` で実行、または当該ディレクトリ内）:

- backend: `npm test` / `npm run typecheck` / `npm run build`（esbuild）。DB 系は `db:generate`（マイグレーション生成）、`db:migrate` / `db:push`、`db:studio`、`db:triggers`（updated_at トリガ適用）、`db:seed`（部位マスタ投入）。Drizzle Kit（turso dialect）は `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` を使う。
- frontend: `npm run dev`（Vite、MSW モック付き）/ `npm test`（Vitest）/ `npm run typecheck` / `npm run build`。
- shared / cognito-trigger: `npm test`、`npm run build`。

DB マイグレーション + シードはルートの `migrate.sh`（環境変数 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` を要求 → `db:push` → `db:triggers` → `db:seed`）。デプロイは `deploy.sh`（手動デプロイ）。CD については後述。

## 環境

devcontainer（`mcr.microsoft.com/devcontainers/typescript-node`）に AWS CLI、Terraform、GitHub CLI、Claude Code がプリインストールされている。`~/.aws` と `~/.ssh` はホストから bind マウントされる。

Terraform および AWS CLI の実行には `AWS_PROFILE=terraform` を指定すること（`~/.aws` に設定済みのプロファイル）。このプロファイルには IAM ロール作成を含む必要な権限がある。`deploy.sh` では冒頭で `export AWS_PROFILE=terraform` を設定済み。手動で terraform コマンドを実行する場合も同様に指定すること。

DB は **Turso（libSQL/SQLite, 東京 `nrt`）**。Terraform 管理外で、`turso` CLI で作成し（`turso db create omome --location nrt`）、接続情報（`turso db show omome --url` / `turso db tokens create omome`）を Terraform 変数 `turso_database_url` / `turso_auth_token`（`infra/terraform.tfvars`）と GitHub Secrets に渡す。`turso` CLI が未導入の環境では別途インストールが必要。

## CD（`.github/workflows/cd.yml`）

`main` への push で発火し、OIDC で短命クレデンシャルを取得して **アプリのコードとフロントエンドアセットのみ**をデプロイする（Lambda 2関数の `update-function-code` → S3 sync → CloudFront 無効化）。CI は `pull_request` でのみ走るので、`main` への直 push はテストを素通りする点に注意。

⚠️ **CD はスキーマ変更もインフラ変更も反映しない**（`drizzle-kit` も `terraform apply` も実行しない。意図的に分離している）。したがって:

- **DB スキーマを変えるリリース**は、CD 任せにせず手動で `migrate.sh` を流すこと。順序が重要で、特に新カラムを使うコードはマイグレーション完了後にデプロイする（[[deploy-migrate-before-signup]] 参照）。
- **`infra/*.tf` を変える PR** をマージしても CD ではインフラに反映されない。`AWS_PROFILE=terraform terraform apply` を手動で実行すること。CD ロールの権限変更などもこれに該当する。
