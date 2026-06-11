# omome バックエンド設計書

**対象**: omome（トレーニング記録アプリ）バックエンドの新規構築
**位置づけ**: ゼロから実装に進めるための設計書。旧 `lift_log`（Spring Boot/Java）は仕様・ロジックの参考として参照するが、本書は新規構築の設計として記述する。
**DBスキーマ**: 別途定義済みの SQLite/Turso スキーマ（`users` / `muscle_groups` / `exercises` / `exercise_muscle_groups` / `workout_days` / `workout_records` / `workout_sets`）を正とする（`DBスキーマ定義_sqlite.md`）。

> ⚠️ **DB 移行の注記（2026-06 / `docs/omome_Turso移行設計書.md` が正）**: 当初 Neon/PostgreSQL（シンガポール）+ 2リージョン構成で設計・実装したが、**Turso（libSQL/SQLite, 東京 nrt）+ 全リソース東京** へ移行済み。本書中の Postgres 固有の記述は移行設計書・`DBスキーマ定義_sqlite.md` で読み替えること。主な差分:
> - 接続: Neon pooled/direct（`DATABASE_URL`/`DIRECT_URL`）→ Turso 単一（`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`、`@libsql/client`）。
> - 型: `uuid`→TEXT、`timestamptz`→TEXT(ISO8601 UTC)、`boolean`→INTEGER、`numeric`(weight)→TEXT、`date`→TEXT。
> - 冪等の UNIQUE 違反検知: PostgreSQL `23505` → libSQL（`code='SQLITE_CONSTRAINT'` + `rawCode` 1555/2067、`isUniqueViolation`）。
> - `updated_at`: BEFORE UPDATE plpgsql トリガ → SQLite AFTER UPDATE トリガ（再帰ガード付き）。
> - インフラ: Neon Provider 廃止。Turso は Terraform 管理外（CLI 作成 → 変数注入）。

---

## 1. システム構成

### 1.1 全体アーキテクチャ

```
[ブラウザ/SPA]
   │
   ▼
[CloudFront] ──────────────┐
   │ /*  （静的配信）        │ /api/* （APIプロキシ）
   ▼                        ▼
[S3: SPA静的ホスティング]   [API Gateway]
                              │  ← Cognito Authorizer で認証検証
                              ▼
                          [Lambda（ファット: 1関数で全ルート処理）]
                              │  ← pooled接続（-pooler）
                              ▼
                          [Neon (PostgreSQL)]
                              ▲
                              │ users 行作成（サインアップ確定時）
[Cognito] ─ Post Confirmation ┘
   │   トリガー → [専用Lambda]
   │
   … サインアップ/ログイン/トークン発行（SPA が直接やり取り）
```

### 1.2 採用技術と責務

| レイヤ | 採用 | 責務 |
|---|---|---|
| CDN | CloudFront | SPA配信、`/api/*` を API Gateway へプロキシ、SPAフォールバック |
| 静的ホスティング | S3 | ビルド済みフロント資産の保管 |
| API | API Gateway | エンドポイント公開、Cognito Authorizer による認証検証 |
| 認証 | Amazon Cognito | ユーザー管理・ログイン・トークン発行 |
| 実行環境 | AWS Lambda（ファット） | 1関数で全APIルートを内部ルーティング |
| 言語/実行 | TypeScript / Node.js | バックエンドロジック |
| Webルーター | Hono（Lambdaアダプタ） | ルーティング・ミドルウェア・エラーハンドリング |
| DB | Neon (PostgreSQL) | 永続化 |
| DBアクセス | Drizzle ORM（想定） | クエリ・型安全・マイグレーション |
| IaC | Terraform | AWSリソース + Neon（コミュニティProvider、version固定） |

> Webルーター/ORM の具体名は推奨。確定前なら §11 の判断事項を参照。

---

## 2. レイヤ構成と責務

ファットLambda内部を以下のレイヤに分割する。旧コードの Controller→Service→Repository 構造を踏襲する。

```
handler (Lambdaエントリ)
  └─ router (Hono) … パス→ハンドラのマッピング、認証コンテキスト注入
       └─ controller … リクエスト/レスポンス変換、入力バリデーション
            └─ service … ビジネスロジック、トランザクション境界
                 └─ repository … DBアクセス（Drizzle）、SQL/クエリ
                      └─ db (Neon接続) … コネクション管理
```

| レイヤ | 責務 | 持たない責務 |
|---|---|---|
| handler | Lambdaイベント受け取り、Honoへ委譲 | 業務ロジック |
| router | ルーティング、認証クレーム取り出し、共通ミドルウェア | DB操作 |
| controller | DTO変換、バリデーション、HTTPステータス決定 | SQL |
| service | 業務ルール、複数repositoryの組み合わせ、整合性担保 | HTTP依存 |
| repository | CRUD、JOIN、クエリ組み立て | 業務判断 |
| db | 接続文字列管理、pooled接続の取得 | クエリ内容 |

### 2.1 依存注入（DI）— 確定済み

各レイヤはモジュール singleton を直 import せず、**ファクトリ関数 + 依存注入**で組み立てる（クラスや DI ライブラリは使わない）。

- repository: `createXxxRepository(db: DB)` が repository オブジェクトを返す。型は `export type XxxRepository = ReturnType<typeof createXxxRepository>`。
- service: `createXxxService(deps)` が必要な repository を `deps` で受け取る（複数依存も可。例: workoutRecords は records+days+exercises）。
- controller: `createXxxController(deps)` が必要な service を受け取り Hono インスタンスを返す。
- 認証ミドルウェア: `createAuthMiddleware({ usersRepo })`。`sub → users.id` 解決は `usersRepo.findByCognitoSub` 経由（`db` を直接触らない）。
- **合成ルート `src/container.ts`**: `createContainer(db = defaultDb)` が db → repositories → services を一括生成する唯一の組み立て点。`app.ts` はこれを使って controller をマウントする。

このため service はモジュールモック（`vi.mock`）不要で、型付きモック repository を `deps` に渡すだけで単体テストできる（テスト方針は `omome_テスト追加TODO.md`）。

---

## 3. 認証設計（Cognito + API Gateway Authorizer）

### 3.1 フロー
1. SPA が Cognito と直接やり取りしてサインアップ/ログイン → トークン取得。
2. SPA は API 呼び出し時に `Authorization` ヘッダへ**アクセストークン**を付与（`Authorization: Bearer <アクセストークン>`）。
3. API Gateway の **Cognito Authorizer** が**アクセストークン**を検証。無効なら Lambda 到達前に 401。
4. Lambda は API Gateway から渡る検証済みクレーム（`sub`）を信頼して利用。

> **API認可に使うトークン = アクセストークン（確定）**。OAuth2.0 の原則どおり API認可にはアクセストークンを使う。バックエンドが各リクエストで必要とするのは `sub`（→ `users.id` 解決）のみで、`sub` はアクセストークンに含まれるため十分。`name`・`email` 等の属性はトークンから読まず、DB（`users.name` 等）を正とする（§3.3 / §3.4）。
> - **API Gateway の Cognito Authorizer は「アクセストークンを検証する」設定にする**（送信側=SPA・検証側=Authorizer の不一致は 401 になるため、必ずそろえる）。
> - フロントは Amplify Auth の `fetchAuthSession()` の `tokens.accessToken` を送る（フロント設計書 §6.4 と整合）。

### 3.2 Lambda 側のユーザーID取得
- リクエストコンテキスト（`requestContext.authorizer.claims.sub` 相当）から Cognito の `sub` を取得する共通ミドルウェアを用意。
- この共通ミドルウェアで **`sub` → アプリ内 `users.id`（UUID）への解決**を行い、以降のレイヤには `users.id` を渡す（§3.3）。各テーブルの絞り込み（`exercises.user_id` 等）は `users.id` 基準。
- 解決クエリは毎リクエスト1回（`cognito_sub` で検索）。`cognito_sub` に UNIQUE インデックスを張るため高速。重くなった場合のキャッシュ最適化は、この**ミドルウェア1箇所**に閉じ込めて後から追加できる設計とする。
- ユーザー解決を各コントローラで個別に行わず、必ずこの共通ミドルウェアに集約する。
- ユーザーIDは「リクエストごとに認証層から来るもの」とし、ボディやクエリからの `userId` は信用しない。

### 3.3 users テーブルと Cognito の対応づけ（**確定**）
- 認証情報（パスワード等）は Cognito が保持。`users` テーブルはアプリ内のユーザー実体（外部キーの参照先）＋プロフィールを保持する。`users` は他テーブル（`exercises.user_id` / `workout_days.user_id`）から参照されるため、アプリDB内に実体を持つ必要がある。
- **対応づけ方式（確定）**: `users.id` は**アプリ生成のUUID**（主キー・外部キー参照先）。Cognito の `sub` は **別カラム `cognito_sub` として保持**し、認証時の突き合わせに使う。
  - 認証基盤を将来 Cognito 以外へ替える際に疎結合を保てる構成。
  - `cognito_sub` には **UNIQUE 制約＋インデックス**を張る（解決クエリの高速化・重複防止）。
- **`sub` → `users.id` の解決方式（確定）**: 毎リクエストで `cognito_sub` から `users.id` を1回引く（§3.2 の共通ミドルウェアで実施）。キャッシュは将来必要になった時点でミドルウェア内に追加。
- **`password_hash` 列は削除**（パスワード管理は Cognito の責務のため不要）。
- **`email` はアプリDB側にも保持**する（一覧表示・運用の利便性。都度 Cognito へ問い合わせるのを避ける）。Cognito 側にもメールは存在するが、表示・JOIN 用途で DB に冗長に持つ。**`email` は nullable**（email クレーム未取得でも users 行を作成できるようにするため。UNIQUE は維持）。
- 上記に伴い `users` テーブル定義を調整する（`password_hash` 削除、`cognito_sub` を NOT NULL UNIQUE 追加、`email` の NOT NULL を外す）。**スキーマ定義（`DBスキーマ定義_sqlite.md`）に反映済み**。

### 3.4 ユーザー行の作成（Post Confirmation トリガー・確定）
- `users` 行は **Cognito の Post Confirmation Lambda トリガー**（アプリ本体とは別の専用Lambda）で、サインアップ確定時に作成する。lazy provisioning は採用しない。
- このトリガー用 Lambda は API Gateway を経由せず、Cognito 起点で発火する。アプリ本体のファットLambdaとは別関数だが、同じ Neon（同じ `users` テーブル）へ書き込む。
- 作成時の値:
  - `id` … トリガー Lambda が UUID を採番（`crypto.randomUUID()`）
  - `cognito_sub` … イベントの `request.userAttributes.sub`
  - `name` … イベントの `request.userAttributes.name`（サインアップ時に入力させた Cognito 標準属性）
  - `email` … イベントの `request.userAttributes.email`（未取得なら NULL）
- **Cognito 標準属性 `name` を使う**: サインアップフォームで name・email を入力させ、Cognito の標準属性として登録する。Post Confirmation トリガーのイベント（`request.userAttributes`）に乗るのは Cognito が保持する属性のみのため、name を属性として持たせることでトリガーから受け取れる。
- **name の正はアプリDBの `users.name`**。Cognito 側の name は users 行作成時の初期値としてのみ使い、以降は同期しない（放置）。表示・JOIN は常にアプリDBの name を正とする。
- §3.2 の共通ミドルウェアは `cognito_sub` から `users.id` を解決する役割に専念する（行作成は行わない）。

---

## 4. データモデル設計

スキーマ定義を正とする。アプリ側で意識すべき設計上のポイントを示す。

### 4.1 エンティティ関係
```
users (1) ──< (N) exercises
users (1) ──< (N) workout_days
exercises (N) >──< (N) muscle_groups  （中間: exercise_muscle_groups, is_primary付き）
workout_days (1) ──< (N) workout_records
exercises (1) ──< (N) workout_records
workout_records (1) ──< (N) workout_sets
```

**users テーブルのスキーマ調整（§3.3 で確定 / PostgreSQLスキーマに反映済み）**: 旧スキーマから以下を変更する。
- `password_hash` 列を**削除**（認証は Cognito の責務）。
- `cognito_sub text NOT NULL UNIQUE` 列を**追加**（Cognito の `sub` との対応づけ。UNIQUE制約の自動インデックスで高速解決）。
- `email` の **NOT NULL を外す（nullable 化）**。email クレーム未取得でも users 行を作成できるようにするため。UNIQUE は維持。
- `id`（uuid・アプリ生成）・`email`・`name` は維持。`email` は Cognito にも存在するが表示/JOIN 用途で DB に保持。

### 4.2 ID生成
- 主キーは `uuid` 型。**DB側のDEFAULT生成は付けない**（必ず明示INSERT。生成漏れは NOT NULL 違反で検知できる）。
- **登録系リソース（exercises / workout_days / workout_records / workout_sets / exercise_muscle_groups）の ID は、クライアント（フロント）が生成して送る**（冪等性のため。詳細は §6.5）。サーバーは受け取った ID でそのまま INSERT する。
- `users.id` は **Post Confirmation トリガー用 Lambda で生成**（`crypto.randomUUID()`）。サインアップ確定時に採番する（Cognito の `sub` は `cognito_sub` 列で保持し、主キーには使わない）。
- `muscle_groups` はマスタのため運用方針に従う（§11-2 で要否確定）。

### 4.3 日時
- タイムスタンプは **`timestamptz` 型**で格納（UTC基準で運用。DBスキーマ定義と整合）。
- アプリは **UTC基準で統一**。サーバーローカルタイムゾーン依存処理は持たない。
- `workout_days.date` は `date` 型（`YYYY-MM-DD` の日付）として扱う。

### 4.4 updated_at
- DB側の **BEFORE UPDATE トリガー**（`set_updated_at()`）で自動更新される。**アプリ側では updated_at を明示セットしない**（DBトリガー任せに一本化・確定）。
- INSERT 時の created_at / updated_at も DB の DEFAULT `now()` に任せる（アプリ側で明示セットしない）。

### 4.5 volume（ボリューム）
- volume（`reps * weight`）は **DB に持たない**（生成列は廃止）。将来の統計実装時に**アプリ側で算出**する。
- スキーマ上 `workout_sets` に volume 列は存在しない。INSERT/UPDATE で volume を扱わない。
- 統計（§6.3）は今回スコープ外（将来追加）。実装する際の計算式は `reps * weight` に統一する。

### 4.6 exercises × muscle_groups（中間テーブル）
- 多対多。`exercise_muscle_groups.is_primary` でメイン/サブを区別。メイン部位は部分ユニークインデックスにより1種目1つまで。
- 種目の作成/更新時に中間テーブルの紐付けを同一トランザクションで操作する。
- 取得時は中間テーブルを JOIN して部位を解決。**レスポンスは部位を配列で返す（メインを先頭）**。詳細は §5.2。

### 4.7 workout_records の一意制約
- `UNIQUE (workout_day_id, exercise_id)`。1トレーニング日につき同一種目は1レコードまで。
- 登録ロジックは upsert 方針（§6-2）。

---

## 5. API設計

ベースパス `/api/v1`。認証は全エンドポイントで必須（Cognito Authorizer）。レスポンスは JSON。

### 5.1 エンドポイント一覧

**exercises** `/api/v1/exercises`
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/` | ログインユーザーの種目一覧 |
| GET | `/{id}` | 種目取得 |
| POST | `/` | 種目作成（部位の紐付け含む） |
| PUT | `/{id}` | 種目更新（部位の紐付け更新含む） |
| DELETE | `/{id}` | 種目削除（CASCADE） |

**muscle-groups** `/api/v1/muscle-groups`
| GET | `/` | 部位マスタ一覧 |
| GET | `/{id}` | 部位取得 |
| POST | `/` | 部位作成（マスタ管理用途。要否は §11-2） |

**workout-days** `/api/v1/workout-days`
| GET | `/` | トレーニング日一覧（各日に実施種目のメイン部位名 `muscleGroups: string[]` を集約付与。ホームの部位チップ表示用。記録順・重複排除。記録ゼロの日は空配列） |
| GET | `/{id}` | 取得 |
| POST | `/` | 作成 |
| PUT | `/{id}` | 更新 |
| DELETE | `/{id}` | 削除（CASCADE） |
| GET | `/calendar?year&month` | カレンダー表示用の月次集約（記録のある日＋種目名を返す。§6.4） |

**workout-records** `/api/v1`
| GET | `/workout-records` | 一覧 |
| GET | `/workout-days/{workoutDayId}/workout-records` | 日付配下の実績一覧 |
| GET | `/workout-records/{id}` | 取得 |
| POST | `/workout-records` | 作成（upsert） |
| POST | `/workout-days/{workoutDayId}/workout-records` | 日付配下に作成（upsert） |
| PUT | `/workout-records/{id}` | 更新 |
| DELETE | `/workout-records/{id}` | 削除（CASCADE） |

**workout-sets** `/api/v1`
| GET | `/workout-records/{workoutRecordId}/workout-sets` | 実績配下のセット一覧 |
| GET | `/workout-sets/{id}` | 取得 |
| POST | `/workout-records/{workoutRecordId}/workout-sets` | セット作成 |
| PUT | `/workout-sets/{id}` | 更新 |
| DELETE | `/workout-sets/{id}` | 削除 |

**statistics** `/api/v1/statistics` … **将来追加（今回は実装しない）**
| GET | `/progress/{exerciseId}` | 種目別の進捗（日別ボリューム・最大重量・総セット/レップ等）。**今回スコープ外。将来追加時に実装する** |

**users** `/api/v1/users`
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/me` | ログインユーザーのプロフィール取得 |
| PUT | `/me` | プロフィール更新（編集可能は `name` のみ。`name` 必須・空/未指定は 400。`email`・`cognito_sub`・`id`・タイムスタンプは編集不可。Cognito 側 name は同期しない） |

### 5.2 レスポンス方針
- **種目レスポンスは部位を配列（リスト）で返す**（確定）。単一部位前提（旧 `muscleGroupId`+`muscleGroup`）ではなく、中間テーブルの構造をそのまま表現する。フロントも参考リポジトリから改修するため旧形互換は不要。
- 種目レスポンスの部位フィールド形（例）:
  ```json
  {
    "id": "ex-001",
    "name": "ベンチプレス",
    "description": "...",
    "muscleGroups": [
      { "id": "mg-chest", "name": "胸", "isPrimary": true },
      { "id": "mg-shoulder", "name": "肩", "isPrimary": false }
    ],
    "createdAt": "..."
  }
  ```
- 配列の規約:
  - **メイン部位（isPrimary=true）は必ず1件**。スキーマの部分ユニークインデックス（メインは1種目1つまで）と整合。
  - **ソート順はメイン部位を先頭**にする（フロントが「メインを取り出す」際に困らないため）。残りのサブ部位の順序は任意（必要なら名称順等を別途定義）。
- 進捗レスポンス（statistics/progress）は **今回スコープ外（将来追加）**。実装する際は、日別の `ProgressData`（date / totalVolume / maxWeight / sets[]）と集計値（maxWeight / totalSets / totalReps）を返す構造とし、volume は `reps * weight` で算出する。仕様の詳細は将来追加時に確定する。

### 5.3 入力バリデーション
- `reps >= 0` / `weight >= 0`（スキーマCHECKと整合）。
- `is_primary` は 0/1。
- 必須項目欠落は 400。
- **種目の作成/更新リクエストも部位を配列で受ける**（レスポンスと対称にする）。リクエスト例:
  ```json
  {
    "id": "ex-001",
    "name": "ベンチプレス",
    "description": "...",
    "muscleGroups": [
      { "id": "mg-chest", "isPrimary": true },
      { "id": "mg-shoulder", "isPrimary": false }
    ]
  }
  ```
  - `id` は**クライアント生成UUID**（新規作成時）。冪等性のため必須（§4.2 / §6.5）。
- 部位配列のバリデーション:
  - **メイン部位（isPrimary=true）はちょうど1件**。0件 or 2件以上は 400。
  - 同一部位の重複指定は 400（中間テーブルの UNIQUE(exercise_id, muscle_group_id) と整合）。
  - **部位配列が空（部位なし）は禁止**。最低1件（=メイン部位）必須。空配列・未指定は 400。

---

## 6. 主要ロジック設計

### 6.1 種目と部位の保存（多対多）
- リクエストは部位を配列で受ける（§5.3）。POST/PUT 時、種目本体の保存と `exercise_muscle_groups` の差し替えを**同一トランザクション**で実施。
- PUT（更新）時は、既存の中間テーブル行を削除→リクエストの配列で再構築する差し替え方式を基本とする（部分更新ではなく全置換）。
- メイン部位はちょうど1つ（部分ユニークインデックス違反に注意）。メインが0件/2件以上、同一部位の重複、**部位配列が空**のいずれもバリデーションで弾く（400）。

### 6.2 workout_records の upsert（確定）
- 登録時 `(workout_day_id, exercise_id)` で既存検索:
  - 無ければ INSERT。
  - 有れば既存レコードを返し、以降のセット追加は既存 record に対して行う。
- UNIQUE 違反（PostgreSQL `23505`）は**握って既存レコードを返す（合流）**。エラー（409）にはしない。ステータスは新規作成・合流とも **200 に統一**（§6.5 の冪等方針と揃える）。
- 「同種目の再記録 = 既存 record へのセット追加」という動線をAPIで表現する。

### 6.3 進捗統計（statistics/progress）※将来追加
- **今回スコープ外**。将来追加時に実装する。
- 実装する際は、対象種目の workout_sets を日付順に集約し、日別ボリューム・最大重量・セット内訳を返す。volume は `reps * weight` で算出する。
- 日別集計のキーや絞り込み期間などの詳細仕様は、将来追加時に確定する。

### 6.4 カレンダー（workout-days/calendar）→ 確定
旧 lift_log のロジック（月の日一覧＋全実績を別取得してフロントで突き合わせ）は参照せず、**1エンドポイントに集約**して新規実装する。

- **方式（確定）: 案A（集約レスポンス）+ 月単位**。
- **リクエスト**: `GET /api/v1/workout-days/calendar?year={YYYY}&month={1-12}`
  - `month` は 1–12。未指定や範囲外は 400。
  - 対象はログインユーザー（§3.2 で解決した `users.id`）の範囲のみ。
- **レスポンス**: 指定月のうち**記録がある日だけ**を配列で返し、各日に種目名リストを含める。
  ```json
  {
    "year": 2026,
    "month": 6,
    "days": [
      {
        "workoutDayId": "uuid",
        "date": "2026-06-03",
        "title": "胸の日",
        "exerciseNames": ["ベンチプレス", "ダンベルフライ"]
      }
    ]
  }
  ```
  - `days` は記録のある日のみ（記録なしの日は含めない）。空月は `days: []`。
  - `title` は `workout_days.title`（NULL なら null）。
  - `exerciseNames` は当日の `workout_records` が参照する種目名（`exercises.name`）の配列。順序は records の作成順を基本（厳密な順序要件はない）。
- **実装**: 当月の `workout_days` と、その配下の `workout_records`・参照先 `exercises.name` を JOIN し、日単位に集約して返す（種目名まで含めるため、フロントは追加取得不要）。フロント設計書 §8.4 と整合。

### 6.5 冪等性設計（クライアント生成ID方式）
Lambda はリクエスト再送・基盤側の自動リトライにより、同一処理が複数回実行されうる。サーバー採番ID＋単純INSERTだと、リトライのたびに別IDで重複行ができる（旧コードの `workout_sets` / `workout_days` / `exercises` 登録がこの構造で、冪等性が無い）。これを以下で防ぐ。

- **方式（確定）: クライアント生成ID（A-1）**。フロントが登録リソースの UUID を生成して送る。ネットワーク再送でもフロントは同じIDを送るため、サーバーには同一IDで複数回届く。
- **PK重複時の冪等ハンドリング（必須）**: 同一IDの2回目以降の INSERT は主キー重複（PostgreSQL `23505`）になる。これを捕捉し、**エラーにせず既存レコードを返す**（200 / 既存扱い）。これによりクライアントから見て1回目も2回目も成功＝冪等になる。
  - ※ クライアント生成IDと「PK重複→既存返却」は**セットで初めて冪等が成立する**。形式チェックのみでは不十分。
- **UUID形式バリデーション（必須）**: 受け取ったIDが UUID 形式かを検証し、不正なら 400。
- **補足**: `workout_sets` は「同じ重量×レップのセットを意図的に2回行う」のが正当な操作のため、内容ベースのUNIQUE制約では重複防止できない。クライアント生成ID＋PK重複ハンドリングで冪等性を担保する。
- `workout_records` は `UNIQUE(workout_day_id, exercise_id)` も併用（§6.2 の upsert）。PK重複・UNIQUE重複の両方を握って既存合流させる。

### 6.6 所有権チェック（認可・冪等性とは別に必須）
クライアントが任意のIDを送れるため、他人のリソースを参照・改変できないよう、全操作で所有権を検証する（A採用と無関係に、マルチユーザーアプリとして必須）。

- 取得・更新・削除時、対象リソースが**ログインユーザー（§3.2 で解決した `users.id`）のものか**を検証。違反は 403（または存在を秘匿するなら 404）。
- 登録時、**親リソースの所有権**を検証する。例:
  - セット登録 → 親 `workout_record` がユーザーのものか
  - 実績登録 → 親 `workout_day` がユーザーのものか、指定 `exercise_id` がユーザーの種目か
- ボディ/クエリ/パスから来る `userId` は信用せず、必ず認証層由来の `users.id` で突き合わせる（§3.2）。

---

## 7. DBアクセス・接続設計

> ⚠️ 本節は旧 Neon 構成の記述。Turso 移行後は **単一接続**（`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`、`@libsql/client`）で、pooled/direct の2系統や `DIRECT_URL` は廃止。詳細は `docs/omome_Turso移行設計書.md`。

### 7.1 接続文字列（旧 Neon。Turso では単一系統）
| 用途 | 接続 | 環境変数（例） |
|---|---|---|
| アプリ実行（Lambda） | pooled（`-pooler` 付き） | `DATABASE_URL` |
| マイグレーション | direct（`-pooler` なし） | `DIRECT_URL` |

- Lambda は並列起動で接続が増えるため pooled 接続を使用（最大10,000クライアント接続、無料枠で利用可）。
- マイグレーションは pooler 非対応操作があるため direct 接続を使用。
- 接続文字列・シークレットは Lambda 環境変数 / Secrets Manager で管理。コードに直書きしない。

### 7.2 コネクション管理
- Lambda 実行コンテキストでの接続再利用を考慮（ハンドラ外で接続を初期化し、ウォームスタートで使い回す）。
- pooled 接続前提のため、Lambda 大量起動時も接続枯渇しにくい。

### 7.3 マイグレーション
- Drizzle Kit 等で管理（§11-7 で確定）。Flyway は使わない。
- スキーマの正は別途のスキーマ定義。マイグレーションはそれを再現する形で構築。

---

## 8. 共通機能設計

### 8.1 エラーハンドリング
- ルーター共通のエラーハンドラを用意。旧 `GlobalExceptionHandler` の方針を踏襲。
  - 一般例外 → 500
  - 不正入力（バリデーション等） → 400
  - 認証/認可 → 401/403（認証検証は基本 API Gateway 側だが、業務的な権限不足は Lambda 側で）
  - リソース未存在 → 404
  - 所有権違反（他人のリソース）→ 403（存在秘匿なら 404）（§6.6）
  - 主キー重複（`23505`）→ **冪等ハンドリング**: エラーにせず既存レコードを返す（200）（§6.5）
  - `workout_records` の UNIQUE 重複（`23505`, 業務制約）→ **既存合流**: エラーにせず既存レコードを返す（200）（§6.2）
- レスポンス形を統一（timestamp / status / error / message / path 等）。

### 8.2 CORS
- API Gateway もしくは CloudFront 側に一本化。許可 Origin は本番ドメイン。
- 旧コードのような複数 localhost 直書きはしない（開発用は環境変数等で切替）。

### 8.3 ロギング
- 構造化ログ（JSON）で CloudWatch Logs へ。リクエストID・ユーザーID（sub）・経路・処理時間を出力。機微情報（トークン等）はログに残さない。

---

## 9. インフラ設計（Terraform）

### 9.1 管理対象
- AWS: Cognito User Pool / App Client、API Gateway、Lambda（アプリ本体）、**Post Confirmation トリガー用 Lambda および Cognito との紐付け**、S3、CloudFront、IAM、（必要なら Secrets Manager）。
- Cognito User Pool は標準属性 `name`・`email` を有効化（サインアップ時に入力させる）。
- Neon: コミュニティ Provider でプロジェクト/DB/ロール/ブランチを管理。

### 9.2 注意点
- Neon Provider はコミュニティ製。`required_providers` で **version を固定**。`terraform init -upgrade` は破壊的変更（リソース再作成=データ損失）のリスクがあるため、CI等では `-upgrade` を付けない運用。
- シークレット（Neon 接続文字列、Cognito 設定）は state に平文で残さない配慮（変数・Secrets Manager 連携等）。

### 9.3 配信
- S3 はオリジンとして CloudFront からのみアクセス（OAC等）。
- CloudFront で SPA フォールバック（403/404 → `index.html`）。
- `/api/*` を API Gateway オリジンへルーティング（同一ドメイン化で CORS を単純化）。

---

## 10. ディレクトリ構成（案）

```
omome/
├─ backend/
│  ├─ src/
│  │  ├─ handler.ts            # Lambdaエントリ
│  │  ├─ app.ts                # Honoアプリ・ルーター組み立て（container を利用）
│  │  ├─ container.ts          # 合成ルート: db→repositories→services（§2.1）
│  │  ├─ middleware/
│  │  │  ├─ auth.ts            # createAuthMiddleware({ usersRepo })。sub→users.id 解決
│  │  │  └─ error.ts           # 共通エラーハンドラ
│  │  ├─ controllers/          # createXxxController(deps)。exercises / muscleGroups / workoutDays / workoutRecords / workoutSets / users
│  │  ├─ services/             # createXxxService(deps)。各 __tests__/ に vitest 単体テスト
│  │  ├─ repositories/         # createXxxRepository(db)
│  │  ├─ db/
│  │  │  ├─ client.ts          # Neon接続（pooled）
│  │  │  └─ schema.ts          # Drizzleスキーマ定義
│  │  ├─ test/                 # mockRepositories.ts（型付きモック repository）
│  │  ├─ dto/                  # リクエスト/レスポンス型
│  │  └─ lib/                  # uuid, 日時(UTC)ユーティリティ等
│  ├─ migrations/              # Drizzle Kit 等
│  └─ package.json
├─ cognito-trigger/            # Post Confirmation トリガー用Lambda（users行作成。本体とは別関数）
│  └─ src/
│     └─ postConfirmation.ts   # イベントからsub/name/emailを取得しusers行をINSERT
├─ frontend/                   # 既存フロント（別途）
└─ infra/                      # Terraform（AWS + Neon）
```

---

## 11. 実装着手前に確定する判断事項

1. ~~**users と Cognito の対応づけ**~~ → **確定済み**: `users.id`=アプリ生成UUID、`cognito_sub` 列を別持ち（UNIQUE）。`sub`→`users.id` は毎リクエスト解決（共通ミドルウェアに集約）。`password_hash` は削除、`email` はDBにも保持（nullable）、行作成は **Post Confirmation トリガー**（§3.2 / §3.3 / §3.4 / §4.1）。
2. **muscle-groups エンドポイント** → **確定済み**: muscle-groups は固定マスタのため**取得のみのAPI**（GET 一覧 / GET 単体）とし、POST（作成）は設けない。マスタデータはマイグレーションで固定投入（§6・§12-1）。／ **users エンドポイントは `GET /users/me`・`PUT /users/me`（編集は name のみ）で確定**（§5.1）。
3. ~~**exercises の部位レスポンス仕様**~~ → **確定済み**: 部位は**配列（リスト）で返す**。メイン部位は先頭・ちょうど1件。リクエストも配列で受ける。**部位が空の種目は禁止（最低1件＝メイン必須）**（§5.2 / §5.3 / §6.1）。
4. ~~**volume 計算式の統一**~~ → **確定済み**: volume は **DB に持たない**（生成列廃止）。将来の統計実装時にアプリ側で `reps * weight` として算出（§4.5 / §6.3）。
5. ~~**updated_at の方式**~~ → **確定済み**: **DB の BEFORE UPDATE トリガー任せに一本化**。アプリ側では明示セットしない（§4.4）。
6. **API 公開形態**（§9.3） → **確定済み**: CloudFront 配下 `/api/*` 集約（同一ドメイン化で CORS を単純化）。
7. **マイグレーションツール**（§7.3） → **確定済み**: Drizzle Kit を採用。
8. **Webルーター/ORMの確定**（§1.2） → **確定済み**: Hono（Lambdaアダプタ）＋ Drizzle ORM を採用。

---

## 12. 未確定事項（留保）

実装の本筋を止めない範囲で、判断を後回しにする事項をここに集約する。確定したら §11 と同様に該当本文へ反映し、本節からは「確定済み」へ移すこと。

### 12-1. users エンドポイントの役割 → 確定済み
- `GET /api/v1/users/me`（プロフィール取得）／ `PUT /api/v1/users/me`（プロフィール更新、編集可能は `name` のみ）で確定（§5.1）。
- users 行は Post Confirmation トリガーで作成（§3.4）。

### 12-2. volume 計算式・updated_at 方式 → 確定済み
- volume: DB に持たず、将来の統計実装時にアプリ側で `reps * weight` 算出（§4.5）。
- updated_at: DB の BEFORE UPDATE トリガー任せに一本化（§4.4）。

### 12-3. users.email の扱い（nullable 化）→ 確定済み
- `users.email` を **nullable に変更**（NOT NULL を外す、UNIQUE は維持）。スキーマ定義に反映済み（§3.3 / §4.1）。
- email 未取得ユーザーの一覧表示・運用上の扱いの細部は実装時に詰める。

### 12-4. statistics/progress（進捗統計）→ 今回スコープ外（将来追加）
- 進捗統計エンドポイントは今回実装しない。将来追加扱いとし、レスポンスの部位表現・日別集計の詳細仕様は将来追加時に確定する（§5.1 / §5.2 / §6.3）。

### 12-5. 冪等ハンドリング時のステータスコード → 確定済み
- 新規作成（1回目）も PK重複・UNIQUE重複時の既存返却（2回目以降）も **200 に統一**（§6.5 / §8.1）。

### 12-6. 旧 lift_log リポジトリの参照範囲 → 確定済み
- カレンダー集約は旧ロジックを参照せず新規に作り直す（§6.4）。統計は今回スコープ外。
- 旧 lift_log は積極的には参照しない方針。必要が生じた箇所のみ個別に参照する。

### 12-7. カレンダー仕様 → 確定済み
- カレンダー（`workout-days/calendar`）は **案A（集約レスポンス）+ 月単位** で確定（§6.4）。`year`/`month` を受け、記録のある日＋種目名（`exerciseNames`）を返す。フロント設計書 §8.4 と整合。

### 12-8. 残課題（実装時に詰める）
- 現時点で本筋を止める残課題はなし。実装時の細部（カレンダーの `exerciseNames` 並び順の厳密化など）は実装で詰める。