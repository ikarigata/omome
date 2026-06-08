# ─────────────────────────────────────────────────────────────────
# GitHub Actions OIDC 連携（CD 用）
#
# CD（.github/workflows/cd.yml）は長期 IAM キーを使わず、GitHub OIDC で
# 短命クレデンシャルを assume する。信頼ポリシーで repo / ブランチを限定し、
# 権限は CD が実行する操作（Lambda 更新 / S3 sync / CloudFront 無効化）に絞る。
# ─────────────────────────────────────────────────────────────────

# GitHub Actions の OIDC ID プロバイダ。
# アカウントに既存（token.actions.githubusercontent.com はアカウント単位で1つ）の
# ため、新規作成せず data source で参照する。共有リソースを Terraform の管理対象
# （destroy 範囲）に含めない狙い。未作成の環境では先に手動 or 別管理で作成すること。
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# GitHub Actions が assume するロール。
# 信頼ポリシーで対象リポジトリの main ブランチに限定する。
resource "aws_iam_role" "github_actions" {
  name = "${local.name_prefix}-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })
}

# CD が必要とする最小権限。
resource "aws_iam_role_policy" "github_actions" {
  name = "${local.name_prefix}-github-actions-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Lambda コード更新（app / cognito-trigger の2関数）と wait 用の取得
        Sid    = "LambdaDeploy"
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
        ]
        Resource = [
          aws_lambda_function.app.arn,
          aws_lambda_function.cognito_trigger.arn,
        ]
      },
      {
        # フロントエンドアセットの S3 sync（--delete 含む）
        Sid    = "FrontendS3Sync"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*",
        ]
      },
      {
        # CloudFront キャッシュ無効化
        Sid      = "CloudFrontInvalidation"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.main.arn
      },
    ]
  })
}
