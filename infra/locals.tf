locals {
  name_prefix = "omome-${var.env}"

  # Neon 接続文字列の構築
  #
  # Neon のエンドポイントホスト形式:
  #   direct : ep-<name>.<region>.aws.neon.tech
  #   pooled : ep-<name>-pooler.<region>.aws.neon.tech
  #
  # replace() で先頭セグメント（ep-<name>）に -pooler を付与する。
  neon_direct_host = neon_project.main.database_host
  neon_pooler_host = replace(local.neon_direct_host, "/^([^.]+)/", "$1-pooler")

  # Lambda 実行用（pooled）: DATABASE_URL
  neon_database_url = "postgresql://${neon_role.omome.name}:${neon_role.omome.password}@${local.neon_pooler_host}/${neon_database.omome.name}?sslmode=require"

  # マイグレーション用（direct）: DIRECT_URL — Drizzle Kit をローカル/CI から実行する際に使う
  neon_direct_url = "postgresql://${neon_role.omome.name}:${neon_role.omome.password}@${local.neon_direct_host}/${neon_database.omome.name}?sslmode=require"
}
