variable "aws_region" {
  description = "AWS リージョン"
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
