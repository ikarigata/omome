# omome: Cloudflare D1 移行 TODO

Neon(PostgreSQL) + AWS Lambda から **Cloudflare D1(SQLite) + Cloudflare Workers** へ移行するための作業洗い出し。

> ⚠️ 最重要前提: **D1 は Cloudflare Workers 専用のバインディング**（Lambda からは直接触れない）。
> したがって「D1 への移行」は実質「**バックエンドを Lambda → Workers へ移す**」ことを内包する。
> これが認証（API Gateway Authorizer がなくなる）・IaC・CD まで連鎖する。単なる DB 差し替えではない。

## 影響範囲サマリ

| レイヤ | 現状 | 移行後 | 規模 |
|---|---|---|---|
| DB | Neon Postgres（シンガポール） | Cloudflare D1（SQLite） | 大 |
| ORM | drizzle `pg-core` + `neon-http` | drizzle `sqlite-core` + `d1` | 大 |
| ランタイム | AWS Lambda（`hono/aws-lambda`） | Cloudflare Workers（`export default`） | 大 |
| 認証 | API Gateway JWT Authorizer → claims を Lambda で参照 | Worker 内で Cognito JWT を自前検証（JWKS） | 中〜大 |
| ユーザ作成 | Cognito Post Confirmation Lambda が Neon に INSERT | （決定事項）Worker での遅延作成 or D1 REST | 中 |
| IaC | Terraform（AWS） | wrangler.toml（+ 任意で Terraform CF Provider） | 大 |
| CD | `aws lambda update-function-code` | `wrangler deploy` | 中 |
| フロント | React/Amplify(Cognito)。S3 + CloudFront 配信 | 認証は据え置き（Cognito 継続時）。配信は据え置き or Pages | 小〜中 |
| `@omome/shared` | DTO の Zod のみ | **変更なし**（DB 非依存） | なし |

---

## 決定が必要な事項（先に決めると TODO が確定する）

1. **認証プロバイダ**: Cognito を継続し Worker 内で JWT 検証 ✅推奨 / 別 IdP（Cloudflare Access 等）へ移行。
   - 推奨理由: フロント(Amplify Auth)をほぼ触らずに済む。Worker 側に JWKS 検証を足すだけ。
2. **ユーザ行のプロビジョニング**: cognito-trigger を廃止し **Worker で初回リクエスト時に遅延 upsert** ✅推奨 / Lambda トリガを残し D1 REST API で書き込み。
   - 推奨理由: D1 は Workers 前提。Lambda から D1 へ書くのは REST トークン管理が増えて筋が悪い。冪等設計（クライアント UUID + 重複合流）とも整合。
3. **フロント配信**: S3 + CloudFront を継続 ✅推奨（移行スコープを縮小）/ Cloudflare Pages へ移行（スタックを CF に寄せる）。
4. **既存データ**: 本番 Neon の実データを D1 へ移送する / **作り直し（greenfield）**。要選択。型変換（uuid→text, timestamptz→text, bool→0/1, numeric→real）が必要。
5. **IaC 方針**: `wrangler.toml` 中心 ✅推奨 / Terraform Cloudflare Provider 併用（既存 AWS tf と二重管理になる点に注意）。
6. **SQLite の型表現**: タイムスタンプ = text(ISO8601) + `CURRENT_TIMESTAMP` ✅推奨（現状 `mode:'string'` と相性良）/ integer(unix)。weight(numeric) = real ✅推奨 / text。

> 以降の TODO は上記の ✅推奨パス（Cognito 継続・Worker 遅延作成・S3/CloudFront 据え置き・データ移送あり・wrangler 中心）を前提に記述。決定が変われば該当フェーズを差し替える。

---

## フェーズ 0: 準備・設計同期

- [ ] Cloudflare アカウント / `wrangler` CLI / API トークン（D1 + Workers 権限）を用意
- [ ] `docs/DBスキーマ定義_postgres.md` を基に **SQLite 版スキーマ定義ドキュメント**を新設（DB 定義の正を更新）
- [ ] 設計書（`docs/omome_バックエンド設計書.md`・`docs/omome_モノレポ構成設計書.md`）に「ランタイム=Workers / DB=D1」を反映
- [ ] `CLAUDE.md` 更新（Neon→D1、Lambda→Workers、`migrate.sh`/`deploy.sh`、Neon リージョン注意は不要に）

## フェーズ 1: スキーマ & マイグレーション（pg → sqlite）

- [ ] `backend/src/db/schema.ts` を `drizzle-orm/sqlite-core` で書き直し
  - [ ] `uuid` → `text`（UUID 文字列を格納。アプリ生成 UUID 前提は維持）
  - [ ] `timestamp(withTimezone)` → `text` + デフォルト `sql\`CURRENT_TIMESTAMP\``
  - [ ] `boolean(is_primary)` → `integer({ mode: 'boolean' })`
  - [ ] `numeric(weight)` → `real`
  - [ ] `date(workout_days.date)` → `text`（`YYYY-MM-DD`）
  - [ ] 部分ユニークインデックス（`WHERE is_primary = true`）= SQLite の partial index で再現
  - [ ] `UNIQUE(workout_day_id, exercise_id)` 等の複合ユニークを維持
  - [ ] relations 定義は流用可（参照整合は変わらず）
- [ ] `updated_at` 自動更新: Postgres の BEFORE UPDATE トリガ相当を **SQLite トリガ**で再現（マイグレーション SQL に同梱）or アプリ層で明示更新へ方針変更
- [ ] 外部キー `ON DELETE CASCADE` を維持（D1 は `PRAGMA foreign_keys=ON` 前提の確認）
- [ ] `backend/drizzle.config.ts`: `dialect: 'sqlite'`、driver/credentials を D1（またはローカル sqlite）向けに変更
- [ ] `drizzle-kit generate` で SQLite マイグレーション再生成（既存 Postgres マイグレーションは破棄/別管理）
- [ ] マイグレーション適用パスを `wrangler d1 migrations apply` に統一（`db:migrate`/`db:push` スクリプト差し替え）

## フェーズ 2: DB クライアント & 冪等性ハンドリング

- [ ] `backend/src/db/client.ts`: `neon-http` → `drizzle(env.DB)`（D1 バインディング）。**モジュール常駐の単一 db をやめ、リクエストごとに `c.env.DB` から生成**する形へ
- [ ] `backend/src/types.ts` の `HonoEnv`: Lambda の `event` 型を捨て、Workers Bindings（`{ DB: D1Database }`）+ `userId` 変数へ
- [ ] `backend/src/app.ts`: `createContainer()` のモジュール常駐生成を見直し、**リクエスト毎に db を注入**（ミドルウェアで `c.env.DB` から container を組み立てる等）
- [ ] **`isUniqueViolation`（`middleware/error.ts`）を SQLite 用に書き換え**（現状 PG コード `23505` を判定）。D1/SQLite は `UNIQUE constraint failed` メッセージ/`D1_ERROR` で判定する必要あり ← 冪等設計（クライアント UUID + 重複合流）の要なので最重要
- [ ] リポジトリの `db.batch([...])`（`exercises`/`workoutDays`/`workoutSets`/`workoutRecords`）: drizzle-d1 も `batch` 対応のため概ね流用可。型 `BatchItem<'pg'>` → `BatchItem<'sqlite'>` へ
- [ ] `returning()` の D1 対応状況を確認（D1 は RETURNING 対応。各 upsert/insert の戻り取得を検証）
- [ ] `db:seed`（部位マスタ投入）を D1 向けに（`wrangler d1 execute` or 専用 Worker ルート）

## フェーズ 3: ランタイム & 認証（Lambda → Workers）

- [ ] `backend/src/handler.ts`: `hono/aws-lambda` の `handle(app)` をやめ、`export default app`（Workers fetch ハンドラ）へ
- [ ] **`backend/src/middleware/auth.ts` を Worker 用に全面改修**
  - [ ] 現状は API Gateway が検証済みの claims（`event.requestContext.authorizer.jwt.claims.sub`）を読むだけ → Worker には Authorizer がないので **JWT 自前検証**（Cognito JWKS で署名・iss・aud・exp 検証）を実装
  - [ ] 検証後 `sub` → `users.id` 解決は踏襲。**ユーザ未存在時に遅延 upsert**（決定事項2の推奨）でユーザ行を作成
- [ ] `wrangler.toml` 作成（Worker 名、`compatibility_date`、`nodejs_compat`、D1 バインディング `[[d1_databases]]`、ルート/カスタムドメイン）
- [ ] 環境変数/シークレット: `DATABASE_URL`/`DIRECT_URL` 廃止。Cognito 検証用（User Pool ID, region, JWKS, audience=client id）を Worker の vars/secret に
- [ ] `backend/package.json`: `dev` → `wrangler dev`、build を wrangler バンドルに、`@types/aws-lambda` 撤去 → `@cloudflare/workers-types` + `wrangler` 追加。esbuild 設定（`esbuild.mjs`）は wrangler バンドルに置換検討
- [ ] CORS / ルーティング（`/api/v1/*`・`/health`）が Workers でも同等に動くことを確認

## フェーズ 4: cognito-trigger の扱い

- [ ] （推奨パス）**`cognito-trigger` ワークスペースを廃止**し、ユーザ作成を Worker の遅延 upsert に移管。ワークスペース・テスト・CD ステップ・Cognito トリガ設定（`infra/cognito.tf`）を削除
- [ ] （代替案を選ぶ場合）Lambda を残し Neon→D1 REST API 書き込みに改修

## フェーズ 5: IaC（Terraform AWS → Cloudflare）

- [ ] 撤去/置換: `infra/lambda.tf`・`api_gateway.tf`・`neon.tf`・`iam.tf`（Lambda ロール）・`github_oidc.tf`（AWS OIDC）
- [ ] 維持/縮小: `cognito.tf`（Cognito 継続時。Post Confirmation トリガは廃止）
- [ ] フロント配信を据え置く場合 `s3.tf`・`cloudfront.tf` は維持（CloudFront の API オリジン/ビヘイビアを Worker ドメインへ向け直し）
- [ ] D1 + Worker のプロビジョニング: `wrangler`（推奨）or Terraform Cloudflare Provider。バインディング・カスタムドメイン・D1 を定義
- [ ] `outputs.tf`・`locals.tf`・`variables.tf` を新構成に合わせて整理

## フェーズ 6: CD / 運用スクリプト

- [ ] `.github/workflows/cd.yml`: Lambda 2 関数の `update-function-code` を `wrangler deploy` に置換。AWS OIDC → `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` シークレット
- [ ] D1 マイグレーション適用ステップの方針（CD は現状スキーマ変更を反映しない設計。手動 `wrangler d1 migrations apply` を継続するか CD に組み込むか決める）
- [ ] フロント配信が S3 据え置きなら S3 sync + CloudFront 無効化ステップは維持。Pages 移行なら置換
- [ ] `deploy.sh` を `wrangler deploy` ベースに、`migrate.sh` を `wrangler d1 migrations apply` ベースに改修
- [ ] `setup-github-cicd.local.sh` の AWS 前提を見直し

## フェーズ 7: フロントエンド

- [ ] API ベース URL を Worker のエンドポイント（カスタムドメイン）に変更（`VITE_*` env）
- [ ] 認証 Cognito 継続なら Amplify Auth 周り（`frontend/src/auth/*`）は基本据え置き。トークン送出が新エンドポイントで通ることを確認
- [ ] MSW モック（`frontend/src/mocks/*`）はパス互換なら変更不要

## フェーズ 8: データ移行（既存データを移送する場合）

- [ ] Neon から `pg_dump`（データのみ）
- [ ] 変換スクリプト: uuid→text、timestamptz→ISO text、boolean→0/1、numeric→real、date→text
- [ ] `wrangler d1 execute --file` で D1 へ投入し、件数・整合性（FK・ユニーク）を検証
- [ ] 移行リハーサル（ステージング D1）→ 本番切替手順（ダウンタイム/逆移行手順）を用意

## フェーズ 9: テスト & 検証

- [ ] `isUniqueViolation` の SQLite 判定に対するユニットテスト追加
- [ ] `middleware/__tests__/auth.test.ts` を Worker 認証（JWT 検証 + 遅延 upsert）向けに書き直し
- [ ] サービス/リポジトリのテストはモック中心で概ね流用可。型（`BatchItem`）変更分を追従
- [ ] ローカル統合: `wrangler dev` + ローカル D1（miniflare）で全 `/api/v1` を疎通。必要なら `@cloudflare/vitest-pool-workers` 導入
- [ ] 冪等性 3 ルール（クライアント UUID + 重複合流 / 所有権 / 部位配列制約）が D1 上でも成立することを E2E 的に確認

## 影響を受けない範囲（確認のみ）

- `@omome/shared`（DTO の Zod のみ。DB 非依存）→ 変更不要
- フロントのビジネスロジック・UI（API 互換を保てば据え置き）

## リスク / 留意

- D1 はサイズ・同時書き込み・トランザクション特性（インタラクティブ tx 非対応、`batch` は原子的）に Postgres と差。既存は `batch` 中心なので親和性は高いが要検証
- SQLite には `timestamptz`/`numeric` の厳密型がない → 表現方針（フェーズ0 決定）を全レイヤで一貫させる
- `RETURNING` / partial index / トリガの D1 対応状況を早期に PoC で確認
- 認証を Worker 自前検証に移すことで、API Gateway 任せだった検証責務がアプリに来る（iss/aud/exp/署名の取りこぼし注意）
- メモリ `neon-no-tokyo-region` は移行完了後に陳腐化（D1 はエッジ分散）→ 更新/削除

---

### 付録: 現状の主な該当ファイル

- ランタイム/認証: `backend/src/handler.ts`, `app.ts`, `types.ts`, `middleware/auth.ts`
- DB/冪等: `backend/src/db/client.ts`, `db/schema.ts`, `drizzle.config.ts`, `middleware/error.ts`(`isUniqueViolation`), `repositories/*`（`db.batch`）
- ユーザ作成: `cognito-trigger/src/postConfirmation.ts`
- IaC: `infra/{lambda,api_gateway,neon,iam,github_oidc,cognito,s3,cloudfront}.tf`
- CD/スクリプト: `.github/workflows/cd.yml`, `deploy.sh`, `migrate.sh`
- フロント認証: `frontend/src/auth/*`, `api/client.ts`
