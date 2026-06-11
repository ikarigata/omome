terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # S3 バックエンド（推奨）。
  # 初回 init 前に S3 バケット・DynamoDB テーブルを手動作成し、
  # terraform init \
  #   -backend-config="bucket=<your-bucket>" \
  #   -backend-config="dynamodb_table=<your-lock-table>" \
  # で初期化する。
  # 未設定の間はデフォルトのローカル state が使われる。
  #
  # backend "s3" {
  #   key     = "omome/terraform.tfstate"
  #   region  = "ap-northeast-1"
  #   encrypt = true
  # }
}
