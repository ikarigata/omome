# omome CI/CD 導入 TODO

**対象**: omome（トレーニング記録アプリ）への GitHub Actions による CI/CD 導入
**参考**: 別リポジトリ `ikarigata/chore-chore`（iezi）の `.github/workflows/{ci,cd}.yml`。構成（モノレポ + ファット Lambda + Terraform + S3/CloudFront + Cognito）がほぼ同型のため流用する。
**前提**: 既存の `deploy.sh` / `migrate.sh` の手順を正とし、それを CI/CD に写し取る。

---

## chore-chore との差分（流用時の注意 — 重要）

chore-chore の YAML をそのまま貼ると壊れる/意図とズレる箇所。

| 項目 | chore-chore | omome | 対応 |
|---|---|---|---|
| shared の参照名 | `-w shared` | `@omome/shared`（パス `packages/shared`） | `npm run build:shared`（= `-w @omome/shared`）を使う |
| テスト | `npm test -w backend` / `vitest run` | **テストは未整備（テストファイル無し）** | CI からテスト step を**外す**。代わりに typecheck を回す |
| Lambda 関数 | 1つ（app のみ） | **2つ**（backend app + cognito-trigger） | CD で両方の `update-function-code` を実行 |
| frontend env | `VITE_*` 3種（`VITE_API_ENDPOINT` 含む） | `VITE_COGNITO_USER_POOL_ID` / `VITE_COGNITO_CLIENT_ID` の**2種のみ**（API はCloudFront同一オリジン） | `VITE_API_ENDPOINT` は使わない |
| Terraform state | （要確認） | **ローカル state を repo にコミット**（`infra/terraform.tfstate`） | CD で `terraform apply` は**走らせない**（ephemeral runner からローカル state を更新できない／Neon 再作成リスク）。インフラ変更は手動 `deploy.sh` を維持 |
| Node | 22 | 22（`.nvmrc` = 22） | 一致。`setup-node` で `node-version: '22'` |

---

## 設計方針（確定）

- **CI（`ci.yml`）**: `pull_request` → main。typecheck + build + Terraform lint。AWS 認証不要・副作用なし。
- **CD（`cd.yml`）**: `push` → main。Lambda コード更新（app / cognito-trigger）+ S3 sync + CloudFront 無効化。**OIDC で AWS ロールを assume**（長期キーを置かない）。
- CD は**アプリ/アセットのデプロイのみ**。`terraform apply` と DB マイグレーション（`migrate.sh`）は CD に含めず、従来どおり手動運用とする（ローカル state + Neon データ損失リスクのため）。
- ローカル検証済み（2026-06-08 時点）: 全 workspace の `build` / `typecheck`、frontend の dummy env ビルドはいずれも成功する。

---

## フェーズA: CI ワークフロー（`.github/workflows/ci.yml`）

> トリガー: `pull_request` branches: [main]。AWS シークレット不要。

- [ ] `.github/workflows/` ディレクトリ作成
- [ ] job: **lint-and-typecheck**
  - [ ] `actions/checkout@v4`
  - [ ] `actions/setup-node@v4`（`node-version: '22'`, `cache: 'npm'`）
  - [ ] `npm ci`
  - [ ] `npm run build:shared`（shared を最初にビルド。後続 typecheck/build の前提）
  - [ ] `npm run typecheck -w backend`
  - [ ] `npm run typecheck -w cognito-trigger`
  - [ ] `npm run typecheck -w frontend`
- [ ] job: **build**
  - [ ] checkout / setup-node / `npm ci` / `npm run build:shared`
  - [ ] `npm run build -w backend`
  - [ ] `npm run build -w cognito-trigger`
  - [ ] `npm run build -w frontend`（env に dummy の `VITE_COGNITO_USER_POOL_ID` / `VITE_COGNITO_CLIENT_ID` を渡す）
- [ ] job: **terraform**（`working-directory: infra`）
  - [ ] `hashicorp/setup-terraform@v3`
  - [ ] `terraform fmt -check -recursive`
  - [ ] `terraform init -backend=false`（state に触れずプロバイダ取得のみ。`-upgrade` は付けない）
  - [ ] `terraform validate`
- [ ] PR を立てて 3 job が緑になることを確認

---

## フェーズB: CD ワークフロー（`.github/workflows/cd.yml`）

> トリガー: `push` branches: [main]。`permissions: id-token: write / contents: read`（OIDC 用）。

- [ ] job: **deploy**
  - [ ] checkout / setup-node（22, cache npm）
  - [ ] `aws-actions/configure-aws-credentials@v4`（`role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`, `aws-region: ${{ vars.AWS_REGION }}`）
  - [ ] `npm ci`
  - [ ] `npm run build:shared`
  - [ ] `npm run build -w backend` → `(cd backend/dist && zip -qr lambda.zip index.js)`
  - [ ] `npm run build -w cognito-trigger` → `(cd cognito-trigger/dist && zip -qr lambda.zip index.js)`
  - [ ] Deploy Lambda (app): `aws lambda update-function-code --function-name ${{ vars.LAMBDA_APP_FUNCTION_NAME }} --zip-file fileb://backend/dist/lambda.zip` → `aws lambda wait function-updated`
  - [ ] Deploy Lambda (cognito-trigger): 同様に `${{ vars.LAMBDA_TRIGGER_FUNCTION_NAME }}` / `cognito-trigger/dist/lambda.zip`
  - [ ] `npm run build -w frontend`（env: `VITE_COGNITO_USER_POOL_ID` / `VITE_COGNITO_CLIENT_ID` を secrets から）
  - [ ] `aws s3 sync frontend/dist/ s3://${{ vars.FRONTEND_BUCKET }} --delete`
  - [ ] `aws cloudfront create-invalidation --distribution-id ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"`
- [ ] main へのマージで一連が成功することを確認

---

## フェーズC: AWS OIDC 連携（CD の前提）

> CD は IAM ユーザの長期キーではなく、GitHub OIDC で短命クレデンシャルを取得する。`infra/` に Terraform で定義する。

- [ ] OIDC プロバイダ `token.actions.githubusercontent.com` を IAM に登録（`infra/iam.tf` 等）
- [ ] GitHub Actions 用 IAM ロール作成。信頼ポリシーで `repo:ikarigata/omome:*`（または `ref:refs/heads/main`）に限定
- [ ] ロールの権限: `lambda:UpdateFunctionCode` / `lambda:GetFunction`（wait 用）/ `s3:PutObject`/`DeleteObject`/`ListBucket`（対象バケット）/ `cloudfront:CreateInvalidation`。最小権限で付与
- [ ] ロール ARN を出力（`terraform output`）し、後述の GitHub secret に登録

---

## フェーズD: GitHub リポジトリ設定（Secrets / Variables）

> `gh secret set` / `gh variable set` または GitHub UI（Settings → Secrets and variables → Actions）。

- [ ] **Secrets**
  - [ ] `AWS_ROLE_ARN` — フェーズC のロール ARN
  - [ ] `VITE_COGNITO_USER_POOL_ID`
  - [ ] `VITE_COGNITO_CLIENT_ID`
- [ ] **Variables**
  - [ ] `AWS_REGION`（例: `ap-northeast-1`）
  - [ ] `LAMBDA_APP_FUNCTION_NAME` — `terraform output lambda_app_function_name`
  - [ ] `LAMBDA_TRIGGER_FUNCTION_NAME` — `terraform output lambda_cognito_trigger_function_name`
  - [ ] `FRONTEND_BUCKET` — `terraform output frontend_s3_bucket`
  - [ ] `CLOUDFRONT_DISTRIBUTION_ID` — `terraform output cloudfront_distribution_id`

---

## スコープ外（今回は CI/CD に含めない）

- `terraform apply`（インフラ変更）— ローカル state コミット運用のため手動 `deploy.sh` を維持。将来リモート state（S3 backend 等）へ移行したら CD 化を再検討。
- DB マイグレーション（`migrate.sh` / `drizzle-kit push` + seed）— `DIRECT_URL` 必要。手動運用を維持。
  - ⚠️ 運用順序の注意: マイグレーションは Cognito サインアップより**前**に流すこと（`users` 行欠落で全リクエスト 401 になる既知の落とし穴）。
- テスト step — テスト未整備のため。テスト導入後に CI の `lint-and-typecheck` job へ追加する。
- ステージング環境 / 環境別デプロイ。

---

## 確定済み / 留保

**確定済み**
- CI は PR、CD は main push トリガー。
- CD は OIDC ロール assume（長期キー不使用）。
- CD はアプリ/アセットのデプロイのみ。terraform apply・マイグレーションは手動。
- Lambda は app と cognito-trigger の2関数を更新。
- frontend env は Cognito 2変数のみ。

**留保（要判断）**
- Terraform state をリモート化して `terraform plan/apply` も CI/CD に載せるか。
- CD のトリガーを push 即時にするか、タグ/手動 `workflow_dispatch` にするか。
- `npm ci` のキャッシュ最適化や、CI を `paths` フィルタで分割するか。
