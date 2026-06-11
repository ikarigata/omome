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
