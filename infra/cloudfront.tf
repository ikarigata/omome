locals {
  s3_origin_id    = "s3-frontend"
  apigw_origin_id = "apigw"

  # HTTP API invoke_url から hostname だけを抽出する
  # 例: "https://abc123.execute-api.ap-northeast-1.amazonaws.com/" → "abc123.execute-api.ap-northeast-1.amazonaws.com"
  apigw_domain = trimprefix(trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/"), "https://")
}

# S3 用 Origin Access Control（OAC）
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name_prefix}-frontend-oac"
  description                       = "OAC for omome frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  # アジア・北米・ヨーロッパをカバーする価格クラス
  price_class = "PriceClass_200"

  aliases = var.app_domain != "" ? [var.app_domain] : []

  # ─── Origins ────────────────────────────────────────────────────

  # S3: SPA 静的ファイル
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # API Gateway: /api/* プロキシ
  origin {
    domain_name = local.apigw_domain
    origin_id   = local.apigw_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ─── Cache Behaviors ────────────────────────────────────────────

  # /api/* → API Gateway（キャッシュなし、Authorization ヘッダを転送）
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = local.apigw_origin_id
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    compress         = true

    forwarded_values {
      query_string = true
      headers = [
        "Authorization",
        "Origin",
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method",
      ]
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # /* → S3（デフォルト: SPA 静的ファイル）
  default_cache_behavior {
    target_origin_id = local.s3_origin_id
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    compress         = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # ─── SPA フォールバック: 403/404 → index.html ──────────────────
  # S3 からのアクセス拒否（403）と未存在ファイル（404）を index.html に転送し、
  # React Router がクライアントサイドルーティングを担当する。
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # カスタムドメインなし → CloudFront デフォルト証明書を使用
    cloudfront_default_certificate = var.app_domain == ""

    # カスタムドメインを使う場合:
    # - ACM 証明書は us-east-1 で発行が必要
    # - acm_certificate_arn / ssl_support_method / minimum_protocol_version を設定する
    #
    # acm_certificate_arn      = var.acm_certificate_arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${local.name_prefix}-cdn"
  }
}

# S3 バケットポリシー: CloudFront OAC からのみ GetObject を許可
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })
}
