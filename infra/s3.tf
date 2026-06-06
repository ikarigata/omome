data "aws_caller_identity" "current" {}

# SPA 静的ホスティング用 S3 バケット
# CloudFront OAC 経由のみアクセス可（パブリックアクセスは全ブロック）
resource "aws_s3_bucket" "frontend" {
  # アカウント ID を付与してバケット名のグローバル衝突を避ける
  bucket = "${local.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}
