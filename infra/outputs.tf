output "frontend_s3_bucket" {
  description = "フロントエンド静的ファイルの S3 バケット名"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_domain" {
  description = "CloudFront のドメイン（アプリの公開 URL）"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID（デプロイ時の cache invalidation で使用）"
  value       = aws_cloudfront_distribution.main.id
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID（Amplify.configure に渡す）"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito App Client ID（Amplify.configure に渡す）"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_user_pool_endpoint" {
  description = "Cognito JWT 発行者エンドポイント（API Gateway Authorizer の issuer に使用）"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "lambda_app_function_name" {
  description = "アプリ本体 Lambda 関数名（Phase 3 以降のデプロイで使用）"
  value       = aws_lambda_function.app.function_name
}

output "lambda_cognito_trigger_function_name" {
  description = "Post Confirmation トリガー Lambda 関数名（Phase 4 以降のデプロイで使用）"
  value       = aws_lambda_function.cognito_trigger.function_name
}

output "neon_database_url" {
  description = "Neon pooled 接続文字列（Lambda 環境変数 DATABASE_URL。Drizzle Kit の direct 接続には使わない）"
  value       = local.neon_database_url
  sensitive   = true
}

output "neon_direct_url" {
  description = "Neon direct 接続文字列（マイグレーション用 DIRECT_URL。ローカル/CI から Drizzle Kit で使用）"
  value       = local.neon_direct_url
  sensitive   = true
}
