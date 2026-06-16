# omome フロントエンド設計書

**対象**: omome（トレーニング記録アプリ）フロントエンドの新規構築
**位置づけ**: 見た目（UI/デザイン）は旧 `lift_log` フロントをほぼ踏襲しつつ、中身の作り（レイヤ構成・状態管理・API層・認証）は新仕様/新アーキテクチャに合わせて作り直す。本書はその新規構築の設計として記述する。
**前提**: バックエンドは `omome_バックエンド設計書.md`、DBは `DBスキーマ定義_postgres.md` を正とする。認証は Amazon Cognito、APIは `/api/v1` 配下、ID はクライアント生成UUID + 冪等性前提。

---

## 0. 設計の全体方針

| 観点 | 旧 lift_log | omome（本設計） | 理由 |
|---|---|---|---|
| 見た目 | 5色パレット + DotGothic16 + ボトムナビ | **踏襲** | ユーザー要望（見た目はほぼ同じに） |
| 状態管理 | `App.tsx` に全データ集約・props配布 | **TanStack Query でサーバ状態を管理**、画面状態はローカル | 集約構造をやめ、機能単位の取得・キャッシュ・再取得を標準化 |
| 認証 | 自前JWT + localStorage | **Cognito**（SPA直結でトークン取得、API GatewayがAuthorizerで検証） | バックエンド設計で確定済み |
| 種目の部位 | 単一（`muscleGroup: string`） | **配列（`muscleGroups[]`、メイン先頭・1件必須）** | 新スキーマ/新API（中間テーブル）に整合 |
| ID生成 | サーバ採番 | **クライアント生成UUID** | 冪等性（再送・リトライ耐性）のため |
| API層 | リソース別 fetch モジュール | **APIクライアント + Query/Mutation hooks** | 型安全・冪等・所有権前提に作り直す |

---

## 1. 技術スタック

| レイヤ | 採用 | 備考 |
|---|---|---|
| フレームワーク | React 18 | 旧と同じ |
| ビルド | Vite | 旧と同じ（バージョンは最新安定へ更新） |
| 言語 | TypeScript | 旧と同じ |
| ルーティング | React Router v6 | 旧と同じ |
| **サーバ状態管理** | **TanStack Query (v5)** | 本設計で新規導入。取得/キャッシュ/再取得/楽観更新 |
| スタイリング | Tailwind CSS + CSS変数テーマ | 旧の design-system を移植。用途別トークン+CSS変数の土台は残す（テーマ切替UIは初期スコープ外、§5.5） |
| 認証SDK | **AWS Amplify Auth（`aws-amplify`, Gen2）** | 既存 Cognito User Pool（Terraform管理）を参照して使う。トークン管理を自前実装せずに済む（§6.4 で確定） |
| グラフ | recharts | 統計画面（`/statistics`）の推移ラインチャート用。バンドルが重いので統計ページは `React.lazy` で遅延読み込みし、メインバンドルから切り離す |
| 並べ替え | @dnd-kit | セット並べ替えで使用（旧踏襲） |
| UUID生成 | `crypto.randomUUID()` | 追加依存なし |
| 開発時モック | MSW（任意） | 旧と同じ。実APIと切替 |

> ルーティング・スタイリング・グラフ・並べ替えは旧から継続。新規は TanStack Query と Cognito SDK。

---

## 2. ディレクトリ構成（案）

旧の「ページは薄いラッパ、実体は components」という構造は維持しつつ、API層を「APIクライアント」と「Query/Mutation hooks」に分離する。

```
frontend/
├─ src/
│  ├─ main.tsx                  # エントリ（QueryClientProvider / AuthProvider / Router 組み立て）
│  ├─ App.tsx                   # ルーティング定義のみ（旧のようなデータ集約はしない）
│  │
│  ├─ app/
│  │  ├─ providers.tsx          # QueryClient・Auth・Theme のプロバイダ合成
│  │  ├─ router.tsx             # ルート定義・PrivateRoute
│  │  └─ queryClient.ts         # QueryClient 設定（リトライ/staleTime 等）
│  │
│  ├─ auth/                     # 認証（Cognito）
│  │  ├─ AuthProvider.tsx       # 認証状態・ユーザー情報のコンテキスト
│  │  ├─ useAuth.ts             # ログイン/ログアウト/トークン取得フック
│  │  └─ cognito.ts             # Amplify Auth のラッパ（Amplify.configure / signIn / signUp / fetchAuthSession 等）
│  │
│  ├─ api/
│  │  ├─ client.ts              # fetchラッパ（baseURL・認証ヘッダ・エラー正規化）
│  │  ├─ types.ts               # API入出力のDTO型（バックエンドのレスポンス形に対応）
│  │  └─ resources/             # リソース別の「素のAPI関数」（fetchのみ、状態を持たない）
│  │     ├─ exercises.ts
│  │     ├─ muscleGroups.ts
│  │     ├─ workoutDays.ts
│  │     ├─ workoutRecords.ts
│  │     ├─ workoutSets.ts
│  │     └─ users.ts
│  │
│  ├─ queries/                  # TanStack Query のフック（画面はこれを使う）
│  │  ├─ queryKeys.ts           # クエリキーの一元管理
│  │  ├─ useExercises.ts        # useExercises / useCreateExercise / useUpdateExercise ...
│  │  ├─ useMuscleGroups.ts
│  │  ├─ useWorkoutDays.ts
│  │  ├─ useWorkoutRecords.ts
│  │  ├─ useWorkoutSets.ts
│  │  └─ useMe.ts
│  │
│  ├─ pages/                    # 薄いラッパ（旧踏襲）。ルートに対応
│  ├─ components/               # UI本体（旧から見た目を移植）
│  ├─ contexts/                # ※ ThemeContext は初期スコープ外（§5.5）。テーマ追加時に置く
│  ├─ types/                    # ドメイン型（UIで使う形）
│  ├─ lib/                      # uuid・日時(UTC)・フォーマッタ等
│  └─ styles / index.css        # デザインシステム・カラートークン（旧踏襲、§5.5）
```

**旧との差分の要点**
- `App.tsx` から「全データの useState 集約・Promise.all 一括取得・props でのデータ/ハンドラ配布」を撤廃。各ページが必要な Query/Mutation hooks を直接呼ぶ。
- `api/` を「素のAPI関数（resources）」と「Query hooks（queries）」の2層に分離。コンポーネントは原則 `queries/` のフックだけを使う。

---

## 3. 状態管理方針（TanStack Query）

### 3.1 役割分担
- **サーバ状態（DB由来のデータ）= TanStack Query が一元管理**。種目・トレーニング日・実績・セット・部位マスタ・プロフィールはすべて Query で取得・キャッシュする。`App.tsx` に保持しない。
- **画面ローカル状態 = `useState`**。入力中のフォーム値、開閉トグル、編集中のセット配列など、サーバに送る前の一時状態のみローカルで持つ。
- **認証状態 = AuthProvider（Context）**。ログイン済みか・現在ユーザーの最低限の情報を保持（§6）。

### 3.2 QueryClient 設定の方針
- `staleTime`: マスタ系（muscle-groups）は長め（実質不変）、記録系は短め〜0（こまめに最新化）。具体値は実装時に調整（**留保**）。
- `retry`: 認証エラー（401/403）はリトライしない。ネットワーク起因のみ既定リトライ。
- ミューテーション成功後は関連クエリを `invalidateQueries` で再取得（下記）。

### 3.3 クエリキー設計（`queryKeys.ts` に集約）
階層キーで管理し、無効化の範囲を制御する。例（確定ではなく方針）:
```
['exercises']                                  // 種目一覧
['exercises', exerciseId]                      // 種目単体
['muscleGroups']                               // 部位マスタ
['workoutDays']                                // 日一覧
['workoutDays', workoutDayId]                  // 日単体
['workoutDays', workoutDayId, 'records']       // 日配下の実績一覧
['workoutRecords', recordId]                   // 実績単体
['workoutRecords', recordId, 'sets']           // 実績配下のセット
['me']                                         // プロフィール
['calendar', year, month]                      // カレンダー集約
```

### 3.4 ミューテーションと無効化の基本パターン
- 種目作成/更新/削除 → `['exercises']`（と該当単体）を invalidate。
- 実績の作成（upsert）→ 親の `['workoutDays', dayId, 'records']` を invalidate。
- セットの作成/更新/削除 → `['workoutRecords', recordId, 'sets']` を invalidate。
- トレーニング日の作成/更新/削除 → `['workoutDays']`・`['calendar', ...]` を invalidate。
- 楽観的更新（optimistic update）を入れるかは画面ごとに判断（**留保**: まずは invalidate ベースで実装し、体感が必要な箇所だけ後から楽観更新を足す）。

---

## 4. API クライアント層

### 4.1 client.ts（共通fetchラッパ）
旧 `authenticatedFetch` を作り直す。責務:
- baseURL の付与（`/api/v1`。CloudFront 同一ドメイン配信のため本番は相対パスでよい。§バックエンド §9.3）。
- **認証ヘッダ付与**: Cognito（Amplify）から取得した**アクセストークン**を `Authorization: Bearer` に付与（§6.4 で確定）。Amplify の `fetchAuthSession()` の `tokens.accessToken` を使う。
- エラー正規化: HTTPステータスを判別し、アプリ共通のエラー型に変換（401/403/404/400/409/500）。Query 側の `retry` 判定やトースト表示に使う。
- 旧コードの大量の `console.log` デバッグ出力は持ち込まない。

### 4.2 resources/（素のAPI関数）
バックエンド §5.1 のエンドポイントに1:1で対応する関数を置く。状態は持たず、入出力DTOだけ扱う。主な関数（抜粋）:
- exercises: `list / get / create / update / remove`
- muscleGroups: `list / get`（**POST は無い**。マスタは取得のみ。バックエンド §11-2）
- workoutDays: `list / get / create / update / remove / calendar`
- workoutRecords: `list / listByDay / get / create(upsert) / update / remove`
- workoutSets: `listByRecord / get / create / update / remove`
- users: `getMe / updateMe`（編集可能は `name` のみ。バックエンド §5.1）

### 4.3 冪等性対応（クライアント生成UUID）
バックエンド §6.5（クライアント生成ID方式）に対応する。
- 登録系（exercises / workoutDays / workoutRecords / workoutSets / exercise_muscle_groups 紐付け）の **新規作成時、フロントが `crypto.randomUUID()` で id を採番してリクエストボディに含める**。
- 再送・リトライ時も**同じ id を送る**ことで、サーバ側の「PK重複→既存返却（200）」と組み合わさって冪等になる。
  - 実装上の注意: TanStack Query の `retry` で再送される場合に同一idが維持されるよう、**idはミューテーション関数の外（呼び出し側 or mutationFnの引数）で確定させ、リトライ間で再生成しない**。具体的な持たせ方は実装時に確定（**留保**）。
- `workout_records` は `(workout_day_id, exercise_id)` のUNIQUEでも合流（upsert, 200）。フロントは「同じ日に同じ種目を追加 = 既存実績への合流」を前提に、作成後はサーバが返す実績を正とする。
- レスポンスは新規作成・合流とも **200**（バックエンド §12-5）。フロントは 200/201 を区別せず成功として扱う。

### 4.4 所有権・認可エラー
バックエンド §6.6 により、他人のリソース操作は 403（または存在秘匿で 404）。フロントは 403/404 を「アクセス不可」として共通ハンドリング（一覧へ戻す等）。ユーザーIDはトークン由来でサーバが解決するため、**フロントは userId をボディに含めない**（バックエンド §3.2）。

---

## 5. 型設計（旧との非互換の解消）

### 5.1 種目（部位の配列化）— 最重要の変更
旧 `Exercise.muscleGroup: string`（単一）を廃止し、**配列**にする。バックエンド §5.2 のレスポンス形に対応。

```ts
// 取得時（レスポンス）
interface ExerciseMuscleGroup {
  id: string;        // muscle_group_id
  name: string;
  isPrimary: boolean;
}
interface Exercise {
  id: string;
  name: string;
  description?: string;
  muscleGroups: ExerciseMuscleGroup[];  // メインが先頭・ちょうど1件含む
  createdAt: string;
}

// 作成/更新時（リクエスト）— レスポンスと対称（バックエンド §5.3）
interface ExerciseUpsertRequest {
  id: string;        // ★ クライアント生成UUID（新規作成時）
  name: string;
  description?: string;
  muscleGroups: { id: string; isPrimary: boolean }[]; // メインちょうど1件・空不可・重複不可
}
```

UI側の都合で「メイン部位を取り出す」ヘルパ（先頭 or `isPrimary` で探す）を `lib/` に用意する。

### 5.2 セット
スキーマに合わせ `reps` / `weight` を持つ。volume はDBに持たないため**フロントで算出**（バックエンド §4.5: `reps * weight`）。RM計算は Epley 式（旧仕様踏襲、`rmCalculator` を移植）。

### 5.3 日時
UTC基準で受け取り、表示時にローカル整形。`workoutDays.date` は `YYYY-MM-DD` 文字列として扱う（バックエンド §4.3）。

### 5.4 旧型からの主な変更まとめ
- `Exercise.muscleGroup: string` → `Exercise.muscleGroups: ExerciseMuscleGroup[]`
- `Exercise.isFavorite` … 旧UIにあったお気に入り。**新スキーマに該当列が無い**ため、**初期スコープでは廃止**（型にも持たない）。欲しくなった時点でスキーマ列追加とあわせて復活させる（§9.2）。
- 登録系DTOに `id`（クライアント生成UUID）を追加。

---

## 5.5 カラーシステム（テーマ拡張に備えた設計）

**方針（確定）**: テーマ切替UI（ThemeSwitcher）と切替の状態管理（ThemeContext / 永続化）は**初期スコープでは実装しない**。ただし、**ゆくゆくテーマを追加しやすいよう、色の割り当てシステム（セマンティックトークン + CSS変数）は旧 lift_log の良い構造をそのまま土台として残す**。これにより「テーマ追加 = CSS変数ブロックを1つ足すだけ」で済む状態を維持する。

### 5.5.1 2層構造（旧 lift_log を踏襲）
色は2層に分けて定義する。コンポーネントは**用途別トークンだけ**を参照し、生の色（パレット）や16進数を直接書かない。

1. **基本パレット**（生の色。5色 + 補助）
   `--color-main / --color-sub / --color-accent / --color-container / --color-pure` など。
2. **用途別トークン**（セマンティック。パレットを参照）
   `--color-surface-* / --color-content-* / --color-interactive-* / --color-navigation-* / --color-input-*`。

Tailwind 側は旧と同様、用途別トークンを `rgb(var(--token) / <alpha-value>)` 形式で色クラス化する（`bg-surface-primary`, `text-content-accent` 等）。コンポーネントはこのクラスのみを使う。

```css
:root {
  /* 1. 基本パレット（omome デフォルト = 旧オリジナル踏襲） */
  --color-main: 241 239 223;   /* #F1EFDF */
  --color-sub: 38 39 42;       /* #26272A */
  --color-accent: 232 96 41;   /* #E86029 */
  --color-container: 59 60 63; /* #3B3C3F */
  --color-pure: 255 255 255;   /* #FFFFFF */

  /* 2. 用途別トークン（パレットを参照。コンポーネントはこちらだけ使う） */
  --color-surface-primary: var(--color-main);
  --color-surface-secondary: var(--color-sub);
  --color-content-primary: var(--color-sub);
  --color-content-accent: var(--color-accent);
  --color-interactive-primary: var(--color-accent);
  --color-navigation-bg: var(--color-accent);
  --color-input-bg: var(--color-container);
  /* …（旧 index.css の用途別トークンをそのまま移植） */
}
```

### 5.5.2 テーマ拡張の仕組み（実装はしないが土台は用意）
将来テーマを足すときは、`[data-theme="..."]` セレクタで**用途別トークン（必要ならパレットも）を上書きするブロックを1つ追加するだけ**でよい構造にしておく。アプリ初期状態は `data-theme` 属性なし = `:root`（デフォルト）で動く。

```css
/* 将来追加する場合の例。初期スコープでは記述しなくてよいが、構造として想定しておく */
[data-theme="cool"] {
  --color-main: 22 26 30;
  --color-accent: 0 255 200;
  /* …用途別トークンの上書き */
}
```

切替は「`<html>` の `data-theme` 属性を差し替えるだけ」で全画面に反映される（CSS変数の継承による）。

### 5.5.3 初期スコープでやること / やらないこと
| 項目 | 初期スコープ | 備考 |
|---|---|---|
| 用途別トークン + CSS変数（`:root`） | **やる** | 旧 `index.css` のトークン定義を移植 |
| Tailwind の用途別色クラス | **やる** | 旧 `tailwind.config.js` の色定義を移植 |
| コンポーネントが用途別クラスのみ参照 | **やる** | 生色/16進直書き禁止（テーマ化の前提） |
| `[data-theme]` 上書きブロック（複数テーマ） | やらない | 構造だけ想定。テーマ追加時に足す |
| ThemeContext / ThemeSwitcher / 永続化 | やらない | テーマ追加時に導入 |

> この方針により、テーマ機能を足す段階では「CSS変数の上書きブロック追加」と「`data-theme` を切り替える薄い仕組み（Context + 永続化 + UI）」を載せるだけでよく、各コンポーネントの修正は不要になる。

---

## 6. 認証設計（Cognito）

旧の自前JWT/localStorage を撤廃し、Cognito に置き換える。バックエンド §3。

### 6.1 フロー
1. SPA が Cognito と直接やり取りしてサインアップ/ログイン → トークン取得。
2. API 呼び出し時、`api/client.ts` が `Authorization` ヘッダにトークンを付与。
3. API Gateway の Cognito Authorizer が検証。無効なら Lambda 到達前に 401。
4. フロントは 401/403 を検知したらログイン画面へ誘導。

### 6.2 サインアップで入力させる属性
バックエンド §3.4 に合わせ、サインアップフォームで **name と email を入力**させ、Cognito 標準属性として登録する（Post Confirmation トリガーが users 行作成に使う）。
- 旧サインアップ画面は email + password のみ。**name 入力欄を追加**する（見た目はデザインシステムを踏襲しつつ項目だけ増やす）。

### 6.3 AuthProvider の責務
- 認証状態（ログイン済みか）の保持と、ログイン/ログアウト/トークン取得の提供。
- 現在ユーザーのアプリ内プロフィール（`users.id`・name 等）は **`GET /users/me`（`useMe`）から取得**するのが正。Cognito のトークンからは `sub` 等の認証情報のみを扱い、表示名などアプリのプロフィールはサーバ（DB）を正とする（バックエンド §3.4: name の正はアプリDB）。

### 6.4 SDK・トークン方針（確定）
- **Cognito SDK → 確定: AWS Amplify Auth（`aws-amplify`, Gen2）**。
  - AWS が新規アプリに Amplify Gen2 を推奨。既存 Cognito User Pool（Terraform 管理）を参照して使う構成が公式サポートされており、本プロジェクトの「インフラは Terraform、フロントは既存リソースを参照」と合致する。
  - トークンの保存・自動リフレッシュ・セッション管理を自前実装せずに済む（`amazon-cognito-identity-js` は低レベルで軽量だが、その実装を自前で持つ必要がある）。
  - 主に使う API: `Amplify.configure()`（User Pool ID / App Client ID を設定）、`signUp` / `confirmSignUp` / `signIn` / `signOut`、`fetchAuthSession()`（トークン取得）。
  - トレードオフ: バンドルサイズは `amazon-cognito-identity-js` より大きい。許容する。
- **API に送るトークン種別 → 確定: アクセストークン**。
  - `Authorization: Bearer <アクセストークン>` で送る。OAuth2.0 の原則どおり、API認可にはアクセストークンを使う。
  - バックエンドが各リクエストで必要とするのは `sub`（→ `users.id` に解決）だけで、`sub` はアクセストークンに含まれるため十分。name 等の属性はトークンから読まず、DB（`users.name`）を正として `GET /users/me` から取得する（バックエンド §3.4）。
  - Amplify では `fetchAuthSession()` の `tokens.accessToken` を使う。
  - **要すり合わせ**: API Gateway の Cognito Authorizer も**アクセストークンを検証する設定**にそろえる（送る側・受ける側の不一致は 401 になる）。インフラ設定と整合させること。
- **トークンの保存・更新方式 → 方針確定: Amplify の既定セッション管理に乗る**。
  - Amplify が既定でトークンの保存・自動リフレッシュ・セッション管理を行うため、**保存方式は自前実装せず Amplify 既定に従う**のを基本とする。
  - 既定の保存先はブラウザストレージ（localStorage 相当）。セキュリティ要件で保存先を変えたくなった場合は、Amplify の**カスタムストレージ（メモリ保持等への差し替え）**で対応する。細部はセキュリティ要件確定後に調整（実装時）。
- ログイン/サインアップのエンドポイント: 旧の `/auth/login`・`/signup`（自前API）は使わない。Cognito 直結に変わる前提。

---

## 7. 画面構成・ルーティング

旧の画面・遷移を踏襲する。ルーティング定義は `App.tsx`（または `router.tsx`）に置くが、**データは各ページが Query hooks で取得**する点が旧と異なる。

| パス | 画面 | 主な取得（Query） | 主な更新（Mutation） |
|---|---|---|---|
| `/login` | ログイン | — | Cognito ログイン |
| `/signup` | サインアップ（**name欄追加**） | — | Cognito サインアップ |
| `/` | ホーム（直近の日一覧） | `useWorkoutDays` | 日の作成（＋ボタン） |
| `/calendar` | カレンダー | `useCalendar(year, month)` | — |
| `/statistics` | 統計（種目別の推移グラフ） | `useExercises` / `useExerciseProgress(exerciseId)` | — |
| `/exercises` | 種目管理 | `useExercises` / `useMuscleGroups` | 種目 作成/更新/削除 |
| `/workout/:workoutId` | 日詳細 | `useWorkoutDay` / `useWorkoutRecordsByDay` | 実績削除 等 |
| `/workout/:workoutId/exercises` | 種目選択 | `useExercises` / `useWorkoutRecordsByDay` | — |
| `/workout/:workoutId/exercise/:exerciseId`（+`/edit`） | セット入力 | `useExercise` / 既存実績 | 実績 upsert / セット 作成・更新・削除 |

- `PrivateRoute` は AuthProvider の状態で判定（旧は localStorage 直接参照、新は Context）。
- ボトムナビは見た目そのまま踏襲（ホーム/カレンダー/種目管理/統計）。＋ボタンの「今日の日があれば遷移、なければ作成して遷移」ロジックも踏襲（ただしデータは Query/Mutation 経由）。

---

## 8. 主要ロジックのフロント側対応

### 8.1 種目の作成/更新（部位配列）
- フォームで部位を複数選択し、**メインをちょうど1つ**指定させる（0件/2件以上、同一部位重複、空配列は送信前にバリデーションで弾く。バックエンド §5.3 と対称）。
- 新規作成時は `crypto.randomUUID()` で `id` を採番して送る。
- 成功後 `['exercises']` を invalidate。

### 8.2 実績の登録（upsert）
- 「日詳細 → 種目選択 → セット入力」の動線。種目選択時、**その日に既に記録済みの種目は一覧から除外**（旧踏襲）。
- 実績作成は upsert（同じ日×同じ種目なら既存に合流）。フロントは作成後サーバが返す実績IDを正として、以降のセット追加はその実績に対して行う。

### 8.3 セット入力
- 旧の @dnd-kit による並べ替えUI・前回記録の参照表示を踏襲。
- volume はフロント算出（§5.2）。
- セットの各操作（追加/更新/削除）は実績配下のセットAPI（§4.2）へ。冪等のため新規セットもクライアント生成UUID。

### 8.4 カレンダー（レスポンス構造 確定）
**方式（確定）: 案A（集約レスポンス）+ 月単位**。1回の取得でセル描画に必要な情報（種目名まで）が揃う形にし、旧のように全実績を別取得する非効率をなくす。

- **エンドポイント**: `GET /api/v1/workout-days/calendar?year={YYYY}&month={1-12}`
- **レスポンス**: 指定月のうち**記録がある日だけ**を配列で返す。各日に種目名リストを含める。
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
  - `title` は任意（`workout_days.title` が NULL なら null）。
  - `exerciseNames` は当日の workout_records が参照する種目名（`exercises.name`）の配列。順序は records の作成順を基本とする（厳密な順序が要るUIではないため、サーバ実装の自然な順でよい）。
- **フロントの扱い**: `useCalendar(year, month)` で取得し、`days` を `date` キーでインデックス化してカレンダーセルに割り当て。各セルは旧の見た目を踏襲し、`exerciseNames` を**最大4件表示・超過は「+N」**。セルタップで `workoutDayId` を使い日詳細（`/workout/:workoutId`）へ遷移。
- **クエリキー**: `['calendar', year, month]`。トレーニング日や実績の変更時に invalidate（§3.4）。
- 月送り（前月/翌月）で `year`/`month` を変えて再取得（旧の月ナビ踏襲）。

---

## 9. スコープ・留保事項の一覧

実装の本筋を止めない範囲で、確認・確定が必要な事項をまとめる。

### 9.1 確定が必要（バックエンド/インフラとのすり合わせ）
1. **API Gateway Authorizer の検証トークン設定**: フロントは**アクセストークン**を送ると確定（§6.4）。受け側の Authorizer もアクセストークン検証にそろえる必要がある（インフラ設定との整合確認のみ。方式自体は確定）。

> **確定事項（再掲）**:
> - ① Cognito SDK = AWS Amplify Auth（`aws-amplify`, Gen2）。
> - ② API認可トークン = **アクセストークン**（`sub` のみ使用、name 等はDB由来）。
> - ③ トークン保存・更新 = Amplify 既定のセッション管理に乗る（必要時のみカスタムストレージで調整）。
> - ④ **カレンダーAPI = 案A（集約レスポンス）+ 月単位**で確定（§8.4）。バックエンド設計書 §6.4 にも同内容を反映する。
> - ①〜③は §6.4、④は §8.4。

### 9.2 仕様判断（プロダクト方針）→ すべて確定済み
本節の仕様判断は確定済み。以下のとおり初期スコープを確定する。

> **お気に入り（isFavorite）→ 確定（当面実装しない / あとから追加）**: 旧UIにあった種目のお気に入りは初期スコープから外す（型・UI・APIとも持たない）。欲しくなった時点で、スキーマ列追加とあわせて復活させる。

> **統計画面 → 実装済み**: `/statistics`（ボトムナビ項目あり）。種目を選び、`useExerciseProgress(exerciseId)` でバックエンドの集約（`GET /exercises/:id/progress`、バックエンド §6.3）を取得し、総ボリューム / Max重量 / 推定1RM の推移を recharts のラインチャートで表示する。グラフ依存が重いためページは `React.lazy` で遅延読み込みする。入力画面（`/workout/:workoutId`）の種目カードの「統計」ボタンから `/statistics?exercise=<id>` で当該種目を選択済みの状態で遷移できる。

> **履歴画面 → 実装済み**: `/exercises/:exerciseId/history`（**ボトムナビには出さない**ドリルダウン）。入力画面の種目カードの「履歴」ボタン（「統計」の左）から遷移し、`useExerciseHistory(exerciseId)` でバックエンドの履歴（`GET /exercises/:id/history`、バックエンド §6.3.1）を取得して、直近5セッションのセット内訳（重量×回数）を**閲覧専用**で新しい順に一覧表示する。編集導線は持たない。

> **テーマ切替 → 確定（当面実装しない / 色システムは土台を残す）**: 切替UI・ThemeContext・永続化は初期スコープ外。ただし用途別トークン + CSS変数によるカラーシステムは最初から用意し、テーマ追加が `[data-theme]` ブロックの追加だけで済む状態を維持する（§5.5）。

### 9.3 実装時に詰める（フロント内で完結）
8. QueryClient の `staleTime` / `retry` の具体値。§3.2
9. 楽観的更新を入れる画面の選定。§3.4
10. クライアント生成UUIDをリトライ間で固定する具体的な持たせ方。§4.3
11. MSW を新フロントでも開発用に使うか（使う場合、新APIの形に合わせて handlers を作り直す）。

---

## 10. 旧 lift_log フロントからの移植・破棄の整理

| 区分 | 対象 | 方針 |
|---|---|---|
| **見た目を移植** | `styles/design-system.md`, Tailwind色トークン, `index.css` の用途別トークン+CSS変数, `DotGothic16`, ボトムナビ, 各画面のレイアウト/コンポーネントの見た目 | ほぼそのまま移植（カラーシステムは §5.5 の土台として残す） |
| **作り直す** | `App.tsx`（データ集約）→ ルーティングのみ化 | データは Query hooks へ |
| **作り直す** | `api/`（fetch + 状態混在）→ resources + queries の2層 | 型を新仕様（部位配列・UUID）に更新 |
| **置き換える** | `utils/auth.ts`, `api/auth.ts`, JWT/localStorage | Cognito（AuthProvider）へ全面置換 |
| **更新する** | `types/`（単一部位）→ 部位配列 | §5 |
| **破棄** | 大量の `console.log` デバッグ出力, `lift_log` 固有のトークンキー名 | 持ち込まない |
| **当面破棄（将来追加）** | お気に入り（isFavorite） | 初期スコープから外す。あとから追加 |
| **実装済み** | 統計画面（`/statistics`）/ グラフは recharts | §7 / §9.2。旧の Chart.js ではなく recharts を採用 |
| **当面破棄（土台は残す）** | ThemeSwitcher / ThemeContext / `[data-theme]` 複数テーマ | 切替UIは外すが、カラートークン構造は残す（§5.5） |

---

## 付録: 旧フロント現状サマリ（参考）

- スタック: React18 + Vite4 + TS + React Router6 + Tailwind（CSS変数テーマ）+ Chart.js + @dnd-kit、開発時 MSW。※ 旧 lift_log の統計は Chart.js。omome の統計画面は **recharts** で作り直した（§7 / §9.2）。
- データフロー: `App.tsx` の `AppContent` が全データを useState 集約、起動時 `Promise.all` 一括取得、各ページへ props 配布。→ 本設計で撤廃。
- 認証: 自前JWT、localStorage キー `lift_log_auth_token`、JWT自前デコードで期限確認。→ Cognito へ置換。
- 型: `Exercise.muscleGroup: string`（単一）、ID サーバ採番前提。→ 部位配列・クライアント生成UUID へ。
- デザイン: 5色制限・ボーダーなし・角丸・DotGothic16。→ 踏襲。