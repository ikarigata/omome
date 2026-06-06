# omome 実装 TODO

**対象**: omome（トレーニング記録アプリ）の新規実装全体
**前提**: 各設計書（バックエンド / フロントエンド / モノレポ構成 / DBスキーマ）を正とする。
**着手順**: infra（土台）→ shared → backend / cognito-trigger → infra（トリガー紐付け・デプロイ）→ frontend
**確定済みの前提**:
- zod: v4
- shared の module / moduleResolution: ESM
- cognito-trigger: workspaces に含める
- ルーター: Hono / ORM: Drizzle / マイグレーション: Drizzle Kit
- API認可トークン: アクセストークン / Cognito SDK: Amplify Auth (Gen2)
- カレンダー: 案A（集約レスポンス）+ 月単位

---

## フェーズ0: モノレポ骨組み

- [ ] ルート `package.json` 作成（`private: true`、workspaces 定義: `packages/*` / `backend` / `frontend` / `cognito-trigger` / `infra`）
- [ ] ディレクトリ雛形作成（`packages/shared` / `backend` / `frontend` / `cognito-trigger` / `infra`）
- [ ] `.gitignore`（`node_modules` / `dist` / `.env` / Terraform state 等）
- [ ] Node バージョン固定（`.nvmrc` 等）
- [ ] リポジトリ初期化・初回コミット

---

## フェーズ1: infra（土台）— Terraform

> Cognito User Pool / Neon / S3 / CloudFront / API Gateway / IAM の土台を先に立てる。
> Post Confirmation トリガーの紐付けは cognito-trigger Lambda 実体が必要なため、フェーズ4で後追い。

- [ ] `required_providers` 定義（AWS / Neon コミュニティ Provider）。**Neon Provider は version 固定**（`-upgrade` 運用注意）
- [ ] Terraform バックエンド（state 保管先）設定。シークレットを state に平文で残さない配慮
- [ ] Neon: プロジェクト / DB / ロール / ブランチ作成
- [ ] Neon: pooled（`-pooler`）/ direct 2系統の接続文字列を出力・Secrets 管理
- [ ] Cognito User Pool 作成（標準属性 `name`・`email` を有効化、サインアップ必須化）
- [ ] Cognito App Client 作成（SPA 用）
- [ ] **API Gateway の Cognito Authorizer をアクセストークン検証に設定**（フロント送信側と一致させる）
- [ ] API Gateway 作成（`/api/v1` 配下、全エンドポイント認証必須）
- [ ] アプリ本体 Lambda リソース定義（実体デプロイはフェーズ3以降）
- [ ] S3（SPA 静的ホスティング、CloudFront からのみアクセス: OAC）
- [ ] CloudFront（`/*`→S3、`/api/*`→API Gateway、SPA フォールバック 403/404→`index.html`）
- [ ] IAM ロール / ポリシー（Lambda 実行権限等）
- [ ] CORS を CloudFront / API Gateway 側に一本化

---

## フェーズ2: shared パッケージ（@omome/shared）

> DTO の Zod スキーマと `z.infer` 由来の型を単一ソース化。DB層（Drizzle）は含めない。

- [ ] `packages/shared/package.json`（`main`/`types` を `dist/` に、`zod: ^4`、build/dev スクリプト）
- [ ] `packages/shared/tsconfig.json`（**module/moduleResolution = ESM**、`declaration: true`、`outDir: dist`）
- [ ] `schemas/exercise.ts`（種目レスポンス / Upsert リクエスト。部位配列: メインちょうど1件・空不可・重複不可を `.superRefine()` 等で表現。`id` は UUID）
- [ ] `schemas/muscleGroup.ts`（部位マスタのレスポンス。取得のみ・POSTなし）
- [ ] `schemas/workoutDay.ts`（`date` は `YYYY-MM-DD`、`id` は UUID）
- [ ] `schemas/workoutRecord.ts`（`id` は UUID、upsert 前提）
- [ ] `schemas/workoutSet.ts`（`reps`/`subReps`/`weight` >= 0、`id` は UUID）
- [ ] `schemas/user.ts`（プロフィール取得 / 更新。更新は `name` のみ・必須）
- [ ] `schemas/calendar.ts`（案A 集約レスポンス + 月単位）
- [ ] `types.ts`（`z.infer` で導出した DTO 型の再エクスポート）
- [ ] `index.ts`（公開エントリ・再エクスポート）
- [ ] ビルド確認（`tsc` で `dist/` に `.js` + `.d.ts` 出力）

---

## フェーズ3: backend（ファット Lambda — Hono + Drizzle）

### 3.1 基盤
- [ ] `backend/package.json`（`@omome/shared: *` を依存に追加、Hono / Drizzle / Drizzle Kit / Neon ドライバ）
- [ ] バンドラ設定（ESM 出力で shared と整合）
- [ ] `db/client.ts`（Neon pooled 接続。ハンドラ外で初期化しウォームスタートで再利用）
- [ ] `db/schema.ts`（Drizzle スキーマ定義。DBスキーマ定義を正に再現）
- [ ] `migrations/`（Drizzle Kit。direct 接続使用）
- [ ] muscle_groups マスタの固定投入マイグレーション（胸/肩/背中/腕/腹/脚/その他）

### 3.2 共通機構
- [ ] `handler.ts`（Lambda エントリ → Hono へ委譲）
- [ ] `app.ts`（Hono アプリ・ルーター組み立て）
- [ ] `middleware/auth.ts`（`sub` 取り出し → `users.id` 解決を共通化。各コントローラで個別解決しない）
- [ ] `middleware/error.ts`（共通エラーハンドラ: 400/401/403/404/500、`23505`→既存返却200、レスポンス形統一）
- [ ] 所有権チェックの共通機構（§6.6。全操作でログインユーザーのリソースか検証）
- [ ] 冪等ハンドリング共通化（クライアント生成UUID形式バリデーション + PK重複握り→既存返却200）
- [ ] 構造化ログ（CloudWatch。リクエストID/ユーザーID/経路/処理時間。トークン等の機微情報は出さない）

### 3.3 エンドポイント実装（controller → service → repository）
- [ ] exercises（GET一覧 / GET単体 / POST / PUT / DELETE。部位配列の全置換を同一トランザクション）
- [ ] muscle-groups（GET一覧 / GET単体のみ。POSTなし）
- [ ] workout-days（GET一覧 / GET単体 / POST / PUT / DELETE）
- [ ] workout-days/calendar（`year`/`month` 受け、記録のある日＋`exerciseNames` を集約。範囲外は400）
- [ ] workout-records（一覧 / 日付配下一覧 / 単体 / POST(upsert) / PUT / DELETE。UNIQUE重複→既存合流200）
- [ ] workout-sets（実績配下一覧 / 単体 / POST / PUT / DELETE）
- [ ] users（GET /me / PUT /me。編集は `name` のみ・必須）
- [ ] ~~statistics/progress~~（**今回スコープ外。将来追加**）

---

## フェーズ4: cognito-trigger（Post Confirmation Lambda）+ infra 紐付け

- [ ] `cognito-trigger/package.json`（workspaces に含める。Neon ドライバ）
- [ ] `postConfirmation.ts`（イベントから `sub`/`name`/`email` 取得し users 行を INSERT。`id` は `crypto.randomUUID()`、`email` 未取得は NULL）
- [ ] Terraform: トリガー用 Lambda リソース定義
- [ ] Terraform: Cognito User Pool との Post Confirmation 紐付け
- [ ] アプリ本体 Lambda の実体デプロイ（バンドル → Lambda 更新）
- [ ] 認証〜users行作成〜API疎通の結合動作確認（サインアップ→確定→users行作成→トークンでAPI到達）

---

## フェーズ5: frontend（React + Vite + TanStack Query + Amplify）

### 5.1 基盤
- [ ] `frontend/package.json`（`@omome/shared: *`、React18 / Vite / React Router v6 / TanStack Query v5 / aws-amplify）
- [ ] `main.tsx`（QueryClientProvider / AuthProvider / Router 組み立て）
- [ ] `app/queryClient.ts`（staleTime / retry 方針。401/403 はリトライしない）
- [ ] `app/router.tsx`（ルート定義・PrivateRoute）
- [ ] `app/providers.tsx`（QueryClient / Auth / Theme プロバイダ合成）

### 5.2 カラーシステム（旧 lift_log 踏襲・土台のみ）
- [ ] `index.css`（基本パレット + 用途別トークンを CSS変数で。旧 index.css を移植）
- [ ] `tailwind.config.js`（用途別色クラス。`rgb(var(--token) / <alpha-value>)`）
- [ ] DotGothic16 フォント設定
- [ ] （`[data-theme]` 複数テーマ / ThemeContext / ThemeSwitcher は**スコープ外**。構造だけ想定）

### 5.3 認証（Cognito / Amplify）
- [ ] `auth/cognito.ts`（Amplify.configure / signUp / confirmSignUp / signIn / signOut / fetchAuthSession）
- [ ] `auth/AuthProvider.tsx`（認証状態・コンテキスト。プロフィールは `GET /users/me` を正とする）
- [ ] `auth/useAuth.ts`（ログイン / ログアウト / トークン取得）
- [ ] トークン保存はAmplify既定セッション管理に乗る

### 5.4 API層
- [ ] `api/client.ts`（baseURL `/api/v1`、アクセストークンを `Authorization: Bearer` に付与、エラー正規化。旧の `console.log` は持ち込まない）
- [ ] `api/types.ts`（shared の型を参照）
- [ ] `api/resources/`（exercises / muscleGroups / workoutDays / workoutRecords / workoutSets / users。素のAPI関数）

### 5.5 Query/Mutation hooks
- [ ] `queries/queryKeys.ts`（階層キー一元管理）
- [ ] `useExercises` / `useMuscleGroups` / `useWorkoutDays` / `useWorkoutRecords` / `useWorkoutSets` / `useMe` / `useCalendar`
- [ ] ミューテーション成功後の invalidate パターン実装
- [ ] クライアント生成UUID をリトライ間で固定する持たせ方（実装時確定）

### 5.6 画面（旧 lift_log の見た目を踏襲）
- [ ] ログイン（`/login`）
- [ ] サインアップ（`/signup`。**name 入力欄を追加**）
- [ ] ホーム（`/`。直近の日一覧 + 日作成）
- [ ] カレンダー（`/calendar`。`useCalendar`、exerciseNames 最大4件・超過は +N）
- [ ] 種目管理（`/exercises`。部位配列・メイン1件指定のバリデーション）
- [ ] 日詳細（`/workout/:workoutId`）
- [ ] 種目選択（`/workout/:workoutId/exercises`。記録済み種目は除外）
- [ ] セット入力（`/workout/:workoutId/exercise/:exerciseId`。@dnd-kit 並べ替え、volume フロント算出、RM計算は subReps 除外）
- [ ] ボトムナビ（**統計アイコンは外す**。ホーム/カレンダー/＋/種目管理）
- [ ] ~~統計（`/statistics`）~~（**今回スコープ外。将来追加**）

---

## フェーズ6: 結合・デプロイ・確認

- [ ] CI ビルド順序（shared → backend / frontend / cognito-trigger）
- [ ] フロントを S3 へデプロイ → CloudFront 配信確認
- [ ] 同一ドメイン `/api/*` プロキシ越しの疎通確認
- [ ] 主要動線の通し確認（サインアップ→種目登録→日作成→実績upsert→セット入力→カレンダー表示）
- [ ] 冪等性確認（同一UUID再送で重複行が増えないこと）
- [ ] 所有権確認（他人のリソースに 403/404）

---

## 実装時に詰める留保事項（本筋は止めない）

- [ ] QueryClient の `staleTime` / `retry` 具体値
- [ ] 楽観的更新を入れる画面の選定
- [ ] クライアント生成UUID をリトライ間で固定する具体的な持たせ方
- [ ] MSW を開発用に使うか（使う場合 handlers を新API形に）
- [ ] email 未取得ユーザーの一覧表示・運用上の扱いの細部
- [ ] カレンダー `exerciseNames` の並び順の厳密化