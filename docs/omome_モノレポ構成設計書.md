# omome モノレポ構成設計書

**対象**: omome（トレーニング記録アプリ）のリポジトリ構成、および フロント/バック間で共有する型・バリデーションスキーマ（`shared` パッケージ）の設計
**位置づけ**: フロントとバックにまたがる横断的な構成を定義する。詳細な機能設計は `omome_フロントエンド設計書.md` / `omome_バックエンド設計書.md`、DBは `DBスキーマ定義_postgres.md` を正とする。
**前提**: バックは TypeScript / Hono / Drizzle、フロントは TypeScript / React / Vite。リクエスト/レスポンスのDTOはフロント・バックで対称（バックエンド §5.2 / §5.3、フロント §5.1）。

---

## 0. 設計の狙い

DTO（リクエスト/レスポンスの形）に対する **型定義と入力バリデーションを単一ソース化**する。これを `shared` パッケージに置き、フロント・バック双方から参照する。

| 観点 | 方針 | 理由 |
|---|---|---|
| 型の単一ソース | DTOの型は `shared` の Zod スキーマから `z.infer` で導出 | フロント・バックの型ズレを防ぐ |
| バリデーションの単一ソース | 「メインちょうど1件・空不可・重複不可」等のDTO規約を `shared` の Zod に集約 | 二重実装を防ぐ（バックエンド §5.3 と対称なフロント送信前チェックを同一コードで） |
| 共有の範囲 | **DTO層のみ**を共有する | DB層（Drizzle）は共有しない（§3） |

---

## 1. リポジトリ構成

単一リポジトリ（モノレポ）。ワークスペース管理は **npm workspaces**。

```
omome/
├─ package.json                # ルート（workspaces 定義のみ。アプリ依存は持たない）
├─ packages/
│  └─ shared/                  # フロント/バック共有パッケージ（@omome/shared）
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ index.ts           # 公開エントリ（再エクスポート）
│     │  ├─ schemas/           # Zod スキーマ（DTOの正）
│     │  │  ├─ exercise.ts
│     │  │  ├─ muscleGroup.ts
│     │  │  ├─ workoutDay.ts
│     │  │  ├─ workoutRecord.ts
│     │  │  ├─ workoutSet.ts
│     │  │  ├─ user.ts
│     │  │  └─ calendar.ts
│     │  └─ types.ts           # z.infer で導出した DTO 型の再エクスポート
│     └─ dist/                 # tsc 出力（.js + .d.ts）※ビルド成果物。gitignore
├─ backend/                    # ファットLambda（Hono + Drizzle）。バックエンド §10
│  └─ package.json             # dependencies に "@omome/shared": "*"
├─ frontend/                   # SPA（React + Vite）。フロント §2
│  └─ package.json             # dependencies に "@omome/shared": "*"
└─ infra/                      # Terraform（AWS + Neon）。バックエンド §9
```

> `cognito-trigger/`（Post Confirmation トリガー用 Lambda、バックエンド §10）も同リポジトリに置く場合は backend と並列に配置する。本書では構成上の位置づけのみ示し、詳細はバックエンド設計書に従う。

---

## 2. `shared` パッケージの参照方式

**ビルド済みの JS + 型定義を参照する**方式を採る（TSソース直接参照はしない）。

- `shared` は `tsc` でビルドし、`dist/` に `.js`（実行コード）と `.d.ts`（型定義）を出力する。
- `package.json` の `main` / `types` を `dist/` に向け、フロント・バックは `@omome/shared` という名前で import する。
- フロント（Vite）・バック（Lambda バンドル）ともビルド済み JS を解決するため、各ツールの TS 解決設定に依存しない。

### 2.1 ルート `package.json`（workspaces 定義）

```json
{
  "name": "omome",
  "private": true,
  "workspaces": [
    "packages/*",
    "backend",
    "frontend"
  ]
}
```

### 2.2 `packages/shared/package.json`

```json
{
  "name": "@omome/shared",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch"
  },
  "dependencies": {
    "zod": "^3"
  }
}
```

### 2.3 `packages/shared/tsconfig.json`（.js + .d.ts を出力）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true
  },
  "include": ["src"]
}
```

> `module` / `moduleResolution` はフロント・バックのビルド構成にそろえて確定する（**留保**: ESM/CJS いずれにそろえるかは backend のバンドラ設定確定時に詰める）。

### 2.4 フロント / バックからの参照

各 `package.json` の `dependencies` に追加する。

```json
{
  "dependencies": {
    "@omome/shared": "*"
  }
}
```

`npm install` 時に workspaces 機構が `@omome/shared` をローカルパッケージとして解決する（npm がシンボリックリンクを張る）。利用側は通常の import で参照する。

```ts
import { exerciseUpsertRequestSchema, type ExerciseUpsertRequest } from "@omome/shared";
```

### 2.5 ビルド順序

`shared` は他から参照されるため、フロント/バックのビルド前に `shared` をビルドしておく必要がある。

- 開発時: `shared` を `--watch` で常時ビルドしつつ、フロント/バックの dev サーバを動かす。
- CI/本番ビルド: `shared` → backend / frontend の順でビルドする（ルートから `npm run build -w @omome/shared` 等で先行ビルド）。

---

## 3. 共有する範囲（DTO層のみ）

**共有するのは DTO（リクエスト/レスポンスの形）の Zod スキーマと、そこから導出した型だけ**。DB層は共有しない。

| 区分 | 置き場所 | 共有 | 備考 |
|---|---|---|---|
| DTO の Zod スキーマ・型 | `packages/shared` | **する** | フロントの送信前バリデーション・型、バックの入力バリデーション・型の正 |
| Drizzle スキーマ（`db/schema.ts`） | `backend` 内 | **しない** | DBのテーブル定義。バックエンドに閉じる |
| `drizzle-zod` 由来の Zod（使う場合） | `backend` 内 | **しない** | リポジトリ層の INSERT 値チェック等。DTOとは層が別 |

### 3.1 DTO と DB スキーマが一致しない理由

DTO は複数テーブルを JOIN・集約した「APIの形」であり、テーブル1枚と1対1対応しない。代表例が種目（exercises）。

- **DB**: `exercises` テーブルと `exercise_muscle_groups` 中間テーブルが別々に存在し、部位は中間テーブルの行として正規化されている。
- **DTO**: 部位を `muscleGroups: [{ id, isPrimary }]` という配列でネストして持つ（バックエンド §5.2 / §5.3）。中間テーブルという概念はAPIの外に出ない。

このため、Drizzle スキーマ（DB対応）から DTO のバリデーションスキーマを生成することはできない。DTO の Zod は `shared` に**手書き**する。

### 3.2 バリデーションの責務分担

`shared` の Zod が担うのは **DTOの形式・規約の検証**まで。以下はZodの範囲外で、各層の責務として別に実装する。

- **業務ルール / 整合性**（service層、バックエンド §6）: 中間テーブルの全置換、upsert 合流など。
- **所有権チェック**（バックエンド §6.6）: DBを引いて他人のリソースでないか検証。Zodでは判定できない。
- **冪等ハンドリング**（バックエンド §6.5）: PK重複（`23505`）を握って既存返却。Zodの外。
- **フロントの Zod はあくまで UX 向上**（送信前チェック）であり、これがあってもバックの入力バリデーションは省略しない（同一スキーマを双方で実行する）。

---

## 4. 共有スキーマの対象（DTO 一覧）

バックエンド §5.1 のエンドポイントに対応する DTO を `shared/src/schemas/` に置く。リクエストとレスポンスは対称に定義する（バックエンド §5.2 / §5.3、フロント §5.1）。

| ファイル | 主なスキーマ | 主な規約（Zodで表現） |
|---|---|---|
| `exercise.ts` | 種目のレスポンス / Upsert リクエスト | 部位配列: メイン（isPrimary=true）ちょうど1件・空不可・同一部位重複不可。`id` は UUID（新規作成時クライアント生成） |
| `muscleGroup.ts` | 部位マスタのレスポンス | 取得のみ（POSTなし。バックエンド §11-2） |
| `workoutDay.ts` | トレーニング日の各DTO | `date` は `YYYY-MM-DD`。`id` は UUID |
| `workoutRecord.ts` | 実績の各DTO | `id` は UUID。upsert 前提 |
| `workoutSet.ts` | セットの各DTO | `reps>=0` / `weight>=0`（スキーマCHECKと整合）。`id` は UUID |
| `user.ts` | プロフィール取得 / 更新 | 更新は `name` のみ・必須（空/未指定は不可。バックエンド §5.1） |
| `calendar.ts` | カレンダー集約レスポンス | 案A（集約レスポンス）+ 月単位（バックエンド §6.4、フロント §8.4） |

> 「メインちょうど1件」のような配列内条件は Zod の `.superRefine()` 等で表現し、フロント・バック双方で同一の判定を再利用する。

---

## 5. 留保事項

実装の本筋を止めない範囲で、確定が必要な事項。

1. `shared/tsconfig.json` の `module` / `moduleResolution`（ESM/CJS）を、backend のバンドラ設定確定時にそろえて確定する（§2.3）。
2. `zod` のメジャーバージョン（v3 / v4）を確定する。フロント・バックで同一バージョンを `shared` 経由でそろえる。
3. CI でのビルド順序・キャッシュ戦略の具体化（§2.5）。
4. `cognito-trigger/` を同リポジトリに含めるか（含める場合の workspaces への追加要否）。