#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

log() { echo ""; echo "=== $* ==="; }

# Terraform / AWS CLI はこのプロファイルで実行する
export AWS_PROFILE=terraform

# ─── 1. shared / backend / cognito-trigger のビルド ───────────────
log "Build: shared"
cd "$ROOT"
npm run build:shared

log "Build: backend"
npm run build -w backend

log "Build: cognito-trigger"
npm run build -w cognito-trigger

# ─── 2. Lambda zip 作成 ────────────────────────────────────────────
log "Package Lambda zips"
(cd "$ROOT/backend/dist"         && zip -qr lambda.zip index.js)
(cd "$ROOT/cognito-trigger/dist" && zip -qr lambda.zip index.js)

# ─── 3. Terraform apply ────────────────────────────────────────────
log "Terraform init & apply"
cd "$ROOT/infra"
terraform init -input=false
terraform apply -auto-approve

# Terraform outputs
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
CLIENT_ID=$(terraform output -raw cognito_user_pool_client_id)
APP_FUNCTION=$(terraform output -raw lambda_app_function_name)
TRIGGER_FUNCTION=$(terraform output -raw lambda_cognito_trigger_function_name)
BUCKET=$(terraform output -raw frontend_s3_bucket)
CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id)

# ─── 4. フロントエンドのビルド（Cognito 値を埋め込み）─────────────
log "Build: frontend"
cd "$ROOT"
VITE_COGNITO_USER_POOL_ID="$USER_POOL_ID" \
VITE_COGNITO_CLIENT_ID="$CLIENT_ID" \
npm run build -w frontend

# ─── 5. Lambda コードを更新 ────────────────────────────────────────
log "Deploy Lambda: app"
aws lambda update-function-code \
  --function-name "$APP_FUNCTION" \
  --zip-file "fileb://$ROOT/backend/dist/lambda.zip" \
  --output text --query 'FunctionName'

log "Deploy Lambda: cognito-trigger"
aws lambda update-function-code \
  --function-name "$TRIGGER_FUNCTION" \
  --zip-file "fileb://$ROOT/cognito-trigger/dist/lambda.zip" \
  --output text --query 'FunctionName'

# ─── 6. フロントエンドを S3 にアップロード ─────────────────────────
log "Deploy frontend to S3"
aws s3 sync "$ROOT/frontend/dist/" "s3://$BUCKET/" --delete

# ─── 7. CloudFront キャッシュ無効化 ────────────────────────────────
log "CloudFront invalidation"
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/*" \
  --output text --query 'Invalidation.Id'

log "Deploy complete"
echo "URL: $(cd "$ROOT/infra" && terraform output -raw cloudfront_domain)"
