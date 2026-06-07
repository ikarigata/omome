resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-user-pool"

  # ユーザーはメールアドレスでサインイン
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # 標準属性 name をサインアップ必須にする。
  # Post Confirmation トリガーが event.request.userAttributes.name として受け取る。
  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = "1"
      max_length = "256"
    }
  }

  lambda_config {
    post_confirmation = aws_lambda_function.cognito_trigger.arn
  }

  tags = {
    Name = "${local.name_prefix}-user-pool"
  }
}

# SPA 用 App Client（クライアントシークレットなし）
resource "aws_cognito_user_pool_client" "main" {
  name         = "${local.name_prefix}-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  # Amplify Auth (Gen2) が使う認証フロー
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # トークン有効期限
  access_token_validity  = 60 # 分
  id_token_validity      = 60 # 分
  refresh_token_validity = 30 # 日

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}
