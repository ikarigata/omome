provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "omome"
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}

# app Lambda + API Gateway 専用 provider。Neon と同一リージョン（シンガポール）に置き、
# Lambda↔Neon の越境往復をなくす。Cognito/S3/CloudFront/cognito-trigger はデフォルト
# provider（東京）のまま。cognito-trigger は Cognito と同一リージョン必須のため移さない。
provider "aws" {
  alias  = "compute"
  region = var.compute_region

  default_tags {
    tags = {
      Project     = "omome"
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}

provider "neon" {
  api_key = var.neon_api_key
}
