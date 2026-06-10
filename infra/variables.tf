variable "aws_region" {
  description = "AWS リージョン（Cognito / S3 / CloudFront / cognito-trigger を配置する。ユーザーに近い東京）"
  type        = string
  default     = "ap-northeast-1"
}

variable "compute_region" {
  description = "app Lambda + API Gateway を配置するリージョン。Neon（シンガポール）と同一リージョンに同居させ、1リクエスト内の DB 往復レイテンシを削減する。Cognito/S3/CloudFront は var.aws_region 側のまま。"
  type        = string
  default     = "ap-southeast-1"
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

variable "neon_api_key" {
  description = "Neon API キー（Neon コンソール → Account Settings → API Keys で発行）"
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
