# SSM Parameter for JWT secret
# IMPORTANT: After initial apply, manually set the value in AWS Console
# Generate a random 64-character string for the secret
resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project_name}/jwt-secret"
  type  = "SecureString"
  value = "CHANGE_ME_AFTER_APPLY"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Project = var.project_name
  }
}

# Data source to read the JWT secret (for Lambda environment variables)
data "aws_ssm_parameter" "jwt_secret" {
  name       = aws_ssm_parameter.jwt_secret.name
  depends_on = [aws_ssm_parameter.jwt_secret]
}
