#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

log() { echo ""; echo "=== $* ==="; }

export AWS_PROFILE=terraform

log "Get DIRECT_URL from Terraform"
DIRECT_URL=$(cd "$ROOT/infra" && terraform output -raw neon_direct_url)

log "Push schema (drizzle-kit push)"
cd "$ROOT/backend"
DIRECT_URL="$DIRECT_URL" npm run db:push

log "Seed master data"
DIRECT_URL="$DIRECT_URL" npx tsx scripts/seed.ts

log "Migration complete"
