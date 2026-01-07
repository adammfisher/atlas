# S3 bucket for uploads (session files, project files)
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-uploads-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"] # Restrict in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "cleanup-session-uploads"
    status = "Enabled"

    filter {
      prefix = "sessions/"
    }

    expiration {
      days = 30 # Session uploads expire after 30 days
    }
  }
}

# S3 bucket for artifacts (generated files)
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project_name}-artifacts-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"] # Restrict in production
    expose_headers  = ["ETag", "Content-Type", "Content-Disposition"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "artifact-retention-policy"
    status = "Enabled"

    # Move to Glacier after 1 year
    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    # Permanently delete after 7 years (optional - remove if you want indefinite cold storage)
    # expiration {
    #   days = 2555  # ~7 years
    # }
  }
}

# Lambda deployment bucket
resource "aws_s3_bucket" "lambda_deployments" {
  bucket = "${var.project_name}-lambda-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id
  versioning_configuration {
    status = "Enabled"
  }
}
