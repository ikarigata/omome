#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

log() { echo ""; echo "=== $* ==="; }

# Turso 接続情報は環境変数で渡す（Turso は Terraform 管理外のため）。
#   export TURSO_DATABASE_URL='libsql://omome-<org>.turso.io'
#   export TURSO_AUTH_TOKEN='...'
# infra/terraform.tfvars に書いている場合はそこから読み込んでもよい。
if [[ -z "${TURSO_DATABASE_URL:-}" || -z "${TURSO_AUTH_TOKEN:-}" ]]; then
  echo "ERROR: TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を環境変数で設定してください。" >&2
  echo "  turso db show omome --url   /   turso db tokens create omome" >&2
  exit 1
fi
export TURSO_DATABASE_URL TURSO_AUTH_TOKEN

cd "$ROOT/backend"

log "Push schema (drizzle-kit push)"
npm run db:push

log "Apply updated_at triggers"
npm run db:triggers

log "Seed master data"
npm run db:seed

log "Migration complete"
