# Phase 1 プレースホルダー用の最小スタブコード。
# Phase 3（backend 実装後）にビルド成果物の zip に差し替える。

data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.placeholder/lambda.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ status: 'placeholder' }) });"
    filename = "index.js"
  }
}

data "archive_file" "cognito_trigger_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.placeholder/cognito-trigger.zip"

  source {
    content  = "exports.handler = async (event) => event;"
    filename = "index.js"
  }
}

# ─────────────────────────────────────────────────────────────────
# アプリ本体 Lambda（ファット Lambda: 全 /api/v1 を Hono で処理）
# ─────────────────────────────────────────────────────────────────
resource "aws_lambda_function" "app" {
  function_name = "${local.name_prefix}-app"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 30
  memory_size   = 1024

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      NODE_ENV = "production"
      # Turso（東京 nrt）への HTTPS リモート接続
      TURSO_DATABASE_URL = var.turso_database_url
      TURSO_AUTH_TOKEN   = var.turso_auth_token
    }
  }

  tags = {
    Name = "${local.name_prefix}-app"
  }
}

# API Gateway → Lambda の呼び出し許可
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ─────────────────────────────────────────────────────────────────
# Post Confirmation トリガー用 Lambda（users 行を INSERT する専用関数）
# Phase 4 で Cognito User Pool と紐付ける（cognito.tf の lambda_config を有効化）
# ─────────────────────────────────────────────────────────────────
resource "aws_lambda_function" "cognito_trigger" {
  function_name = "${local.name_prefix}-post-confirmation"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  timeout       = 10
  memory_size   = 128

  filename         = data.archive_file.cognito_trigger_placeholder.output_path
  source_code_hash = data.archive_file.cognito_trigger_placeholder.output_base64sha256

  environment {
    variables = {
      # Turso（東京 nrt）への HTTPS リモート接続
      TURSO_DATABASE_URL = var.turso_database_url
      TURSO_AUTH_TOKEN   = var.turso_auth_token
    }
  }

  tags = {
    Name = "${local.name_prefix}-post-confirmation"
  }
}

# Cognito → cognito_trigger Lambda の呼び出し許可
resource "aws_lambda_permission" "cognito_trigger" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_trigger.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
