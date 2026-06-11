variable "aws_region" {
  description = "AWS リージョン（全リソースを東京に統一。DB(Turso) も東京 nrt のため越境が無い）"
  type        = string
  default     = "ap-northeast-1"
}

variable "env" {
  description = "環境名 (prod / staging)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env は prod または staging のいずれかを指定してください。"
  }
}

variable "turso_database_url" {
  description = "Turso データベース URL（libsql://omome-<org>.turso.io）。Turso は Terraform 管理外で、turso CLI で作成した値を渡す。Lambda の環境変数 TURSO_DATABASE_URL に注入する。"
  type        = string
}

variable "turso_auth_token" {
  description = "Turso 認証トークン（turso db tokens create omome）。Lambda の環境変数 TURSO_AUTH_TOKEN に注入する。"
  type        = string
  sensitive   = true
}

variable "app_domain" {
  description = "カスタムドメイン（例: omome.example.com）。CloudFront エイリアスと ACM 証明書が必要な場合のみ設定する。空の場合は CloudFront のデフォルトドメインを使用する。"
  type        = string
  default     = ""
}

variable "cors_origin" {
  description = "API Gateway の CORS 許可オリジン（例: https://d2dc9ic4vkktqm.cloudfront.net）。空の場合はワイルドカード（*）になる。"
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub Actions OIDC の信頼対象リポジトリ（owner/repo 形式）。CD ロールの assume をこのリポジトリの main ブランチに限定する。"
  type        = string
  default     = "ikarigata/omome"
}
