resource "aws_apigatewayv2_api" "main" {
  provider = aws.compute

  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "omome API (Hono fat Lambda)"

  # CORS は API Gateway レベルで一元管理する（Hono 側では設定しない）。
  # CloudFront 経由の同一ドメインアクセスが前提だが、
  # 開発時直接アクセスに備えて allow_origins を変数で切り替え可能にする。
  cors_configuration {
    allow_headers  = ["Authorization", "Content-Type"]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins  = var.cors_origin != "" ? [var.cors_origin] : ["*"]
    expose_headers = []
    max_age        = 86400
  }
}

# Cognito JWT Authorizer（アクセストークン検証）
# フロントは Amplify Auth の fetchAuthSession().tokens.accessToken を Bearer で送る。
# API Gateway の JWT Authorizer がトークン署名・有効期限・発行者を検証する。
resource "aws_apigatewayv2_authorizer" "cognito" {
  provider = aws.compute

  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# Lambda プロキシ統合（payload format 2.0）
resource "aws_apigatewayv2_integration" "app" {
  provider = aws.compute

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.app.invoke_arn
  payload_format_version = "2.0"
}

# 全ルートを Lambda へ委譲（Hono が内部でルーティング）。
# 認証は全エンドポイントで必須。
resource "aws_apigatewayv2_route" "catch_all" {
  provider = aws.compute

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.app.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

# $default ステージ（ステージプレフィックスなしで invoke_url = https://<api-id>.execute-api.<region>.amazonaws.com）
resource "aws_apigatewayv2_stage" "default" {
  provider = aws.compute

  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}
