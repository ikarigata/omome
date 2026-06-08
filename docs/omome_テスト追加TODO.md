# omome テスト追加 TODO

**対象**: omome のローカルテスト整備（shared / backend / frontend / cognito-trigger）
**目的**: CI（`omome_CICD導入TODO.md` フェーズA）に載せられるテストスイートを用意する。テスト導入後に CI の `lint-and-typecheck` job へ `npm test` を追加する。
**参考**: `ikarigata/chore-chore` のテスト構成（vitest。backend はリポジトリをモック注入してハンドラを DB なしで単体テスト、frontend は testing-library + jsdom + MSW）。
**前提（現状確認済み, 2026-06-08）**:
- omome にテストフレームワークは**未導入**（vitest / testing-library いずれも無し）。
- frontend は **MSW を既に導入済み**（`src/mocks/{browser,handlers,data}.ts`）。テストでも再利用できる。
- backend のサービスは**リポジトリをモジュール singleton として直 import**している（DI ではない）。→ 下の「方針決定」参照。

---

## 方針決定（着手前に確定すること — 重要）

### D1. backend サービスのモック戦略 → **案B（DI）で確定・実装済み**
当初はサービスがリポジトリを**直 import**していたが、ユーザ方針により**案B（リポジトリ注入型へリファクタ）を採用**し実装済み。

- repository: `createXxxRepository(db)` / service: `createXxxService(deps)` / controller: `createXxxController(deps)` のファクトリ化。合成ルート `src/container.ts`。詳細は `omome_バックエンド設計書.md` §2.1。
- これによりサービス単体テストは `vi.mock` 不要。型付きモック repository（`src/test/mockRepositories.ts`）を `deps` に渡すだけで成立する。
- 案A（`vi.mock` でモジュール差し替え）・案C（pglite/testcontainers で実 Postgres 結合）は不採用 / 留保。

### D2. backend ルーター/コントローラのテスト
Hono は `app.request('/api/v1/...')` でハンドラを直接叩ける。認証ミドルウェアが Cognito sub → users.id を解決する箇所をどうテスト用に差し替えるか（テスト用に `userId` を注入するミドルウェア or 認証ミドルウェアのモック）を決める。

### D3. テスト DB を使うか
案A で進めるなら不要。案C を採用する場合のみ、ローカル devcontainer の postgres か pglite を使う。

---

## フェーズ0: テスト基盤セットアップ

- [x] **shared**: `vitest` を devDependency 追加、`"test": "vitest run"` スクリプト追加、`vitest.config.ts`（`environment: 'node'`）
- [x] **backend**: `vitest` 追加、`"test": "vitest run"` / `"test:watch": "vitest"` 追加、`vitest.config.ts`（`environment: 'node'`）、型付きモック `src/test/mockRepositories.ts`
- [x] **frontend**: `vitest` / `jsdom` / `@testing-library/react` / `@testing-library/jest-dom` / `@testing-library/user-event` を追加、`"test": "vitest run"` 追加
  - [x] `vitest.config.ts`（`vite.config` を mergeConfig、`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/setupTests.ts']`。`test.env` で `VITE_DEV_BYPASS_AUTH=true` を設定し api/client が Cognito を呼ばず MSW に乗るようにした）
  - [x] `src/setupTests.ts`（`@testing-library/jest-dom` 取り込み、MSW server の `beforeAll/afterEach/afterAll` 設定。`cleanup()` も実施）
  - [x] MSW を**テスト用 node server**（`setupServer`）に流用できるよう `src/mocks/server.ts` を用意（既存 `handlers.ts` を再利用）。テスト描画ユーティリティは `src/test/utils.tsx`
- [x] ルート `package.json` に集約スクリプト追加（`"test": "npm run build:shared && npm test -w @omome/shared && npm test -w backend && npm test -w frontend && npm test -w cognito-trigger"`）
  - 注: shared を先にビルドしてから backend/frontend のテストを回す（既存のビルド順序規約と同じ）

---

## フェーズ1: shared パッケージのテスト（最優先・インフラ不要）

> Zod スキーマ（特に `.superRefine()`）は純粋関数で、最も費用対効果が高い。横断ルール3（部位配列の制約）の正がここにある。

- [x] `exercise.ts`: 部位配列の制約
  - [x] メイン（`isPrimary=true`）ちょうど1件 → OK
  - [x] メイン0件 → エラー
  - [x] メイン2件以上 → エラー
  - [x] 同一部位の重複 → エラー
  - [x] 空配列 → エラー
  - [x] `id` が UUID でない → エラー
- [x] `workoutSet.ts`: `reps` / `subReps` / `weight` >= 0、負値はエラー、`id` は UUID
- [x] `workoutDay.ts`: `date` が `YYYY-MM-DD` 形式、不正形式はエラー
- [x] `user.ts`: 更新は `name` のみ必須、空名はエラー
- [x] `workoutRecord.ts`: 必須フィールド / UUID 検証
- [x] `calendar.ts`: 集約レスポンス（月単位・案A）の形を検証
- [x] 正常系: 各スキーマで valid なペイロードが `parse` を通る回帰テスト

> 注: zod v4 の `.uuid()` は RFC の variant ビットまで検証する。テスト用ダミー UUID は version=4 / variant=8 の形（例 `...-4xxx-8xxx-...`）にする必要がある。

---

## フェーズ2: backend のテスト（案B: DI でモック repository 注入）✅ 実装済み（31 tests green）

> 横断ルール1（冪等性: PK重複→既存返却 200）・ルール2（所有権 403/404）がサービス層の最重要テスト対象。
> 各 service の `__tests__/*.test.ts` に配置。`vi.mock` は使わず `src/test/mockRepositories.ts` を `deps` に注入。

- [x] **exercisesService**
  - [x] `getById`: 他人の所有 → 403、存在しない → 404
  - [x] `upsert`: 既存IDかつ自分の所有 → 既存を返す（冪等・新規 INSERT しない）
  - [x] `upsert`: 既存IDだが他人の所有 → 403
  - [x] `upsert`: 新規 → リポジトリの upsert が呼ばれ、レスポンスでメインが先頭
  - [x] `upsert`: INSERT 競合（upsert→null→再 findById）の合流パス（+競合後が他人なら403）
  - [x] `update`: 中間テーブル全置換をリポジトリ呼び出しで検証（他人なら403で update を呼ばない）
- [x] **workoutRecordsService**: 親（workout_day / exercise）の所有権チェック、upsert 合流（repo が isNew:false を返すケース）
- [x] **workoutDaysService / workoutSetsService**: 冪等 insert + 所有権（親リソースの所有確認）、getCalendar の集約整形
- [x] **usersService**: `getMe`（404 / 表示名 `users.name`） / `updateMe`
- [x] **muscleGroupsService**: 取得のみ（一覧 / 単体404）
- [x] **冪等性の合流（23505）**: repo が 23505 を吸収して既存行を返す前提を、service が透過的に返すことで検証（exercises の null 合流 / records・sets の isNew:false）
- [x] **auth ミドルウェア**: `sub` 無し→401 / users 行無し→401 / 解決した `users.id` を `c.set('userId')`。`app.request()` でテスト
- [ ] （任意・未）**コントローラ/ルーター結合**: `app.request()` で Zod バリデーション失敗時 400 等。D2 の方針に従う
- [ ] （任意・未）**repository 層の結合テスト**: 案C を採用する場合のみ（pglite/testcontainers）

---

## フェーズ3: frontend のテスト（testing-library + jsdom + MSW）

> まず純粋関数 → hooks（MSW でAPIモック）→ コンポーネント/ページの順で価値が高い。

- [x] **lib（純粋関数, インフラ不要・最優先）**
  - [x] `lib/uuid.ts`: `crypto.randomUUID()` ラッパの形式（クライアント生成UUID = 冪等性の前提）。getRandomValues フォールバックも検証
  - [x] `lib/date.ts`: 日付フォーマット / パース（`YYYY-MM-DD`、月日数・曜日）
  - [x] `lib/exercise.ts`: メイン部位の取得、`calcVolume` / `calcRM`（RMは subReps 除外）
  - [x] `lib/devFlags.ts`: `VITE_DEV_BYPASS_AUTH` のフラグ判定（`stubEnv` + `resetModules`）
- [x] **queries（TanStack Query hooks, MSW でAPIモック）**
  - [x] `useExercises`（成功 / 500エラー）・`useMe`（取得 / 更新 invalidate）の挙動。他フックも同型のため代表をカバー
  - [x] mutation 系で invalidation が走るか（`useCreateExercise` / `useUpdateMe` で件数・値の反映を確認）
  - [x] テスト用に `QueryClient`（retry オフ）を包む test util（`src/test/utils.tsx`）を用意
- [x] **components**
  - [x] `Button` / `Input` / `ErrorMessage` の表示・disabled・onClick
  - [x] `BottomNav`: アクティブタブ表示、ルーティング（統計タブが無いことも確認）
  - [ ] `PageLayout`: 子要素レンダリング（pages テスト経由で間接カバー。単体は未）
- [x] **pages（重要画面の振る舞い, MSW + memory router）**
  - [x] `ExercisesPage`: 一覧表示、フォーム開閉、バリデーション（名前未入力 / 部位未選択）
  - [x] `HomePage`: 初期表示（日一覧・ユーザー名ヘッダ）
  - [ ] `LoginPage` / `SignupPage` / `ExerciseSelectPage` / `WorkoutDayPage` / `SetInputPage` / `CalendarPage`（重要動線は順次追加。現状は代表画面のみ）

---

## フェーズ4: cognito-trigger のテスト

- [x] `postConfirmation.ts`: サインアップ確定イベントで `users` 行を作成する。`users.id`（アプリ生成UUIDv4）を生成し挿入することを、`@neondatabase/serverless` の `neon` をモックして検証。email 未取得は NULL / sub・name 欠落は throw して INSERT しない
- [x] 既に users 行が存在する場合の冪等な振る舞い（`ON CONFLICT (cognito_sub) DO NOTHING`。再実行しても throw せず INSERT を発行し、重複排除は DB 側の責務であることを確認）

---

## フェーズ5: CI への組み込み

- [ ] `omome_CICD導入TODO.md` フェーズA の `lint-and-typecheck` job に `npm test`（ルート集約スクリプト = `npm test`）を追加
  - **ブロック中**: `.github/workflows/ci.yml` 自体が未作成（CICD導入TODO フェーズAが未着手）。ワークフロー作成時に `npm test` step を入れる。集約スクリプトはローカルで緑（shared 40 / backend 31 / frontend 39 / cognito-trigger 5 = 115 tests）。
- [ ] shared ビルド → 各 workspace の test がCI上で緑になることを確認
- [ ] （任意）カバレッジ計測（`vitest --coverage` / `@vitest/coverage-v8`）の導入要否を判断

---

## 確定済み / 留保

**確定済み**
- テストランナーは **vitest**（全 workspace 共通。chore-chore と統一）。
- frontend は testing-library + jsdom、MSW を流用。
- backend は **案B（DI でモック repository 注入）**で実装（D1 参照。当初の案A は不採用）。
- 着手順は shared（純粋・高ROI）→ backend サービス → frontend lib/hooks → pages/components → cognito-trigger。

**留保（要判断）**
- D1: backend を DI へリファクタ（案B）/ 実DB結合（案C）に踏み込むか。
- D2: コントローラ/ルーター結合テストでの認証ミドルウェアの差し替え方法。
- カバレッジ閾値を CI のゲートにするか。
- E2E（Playwright 等）を将来導入するか（現状スコープ外）。
