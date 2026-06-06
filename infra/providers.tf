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

provider "neon" {
  api_key = var.neon_api_key
}
