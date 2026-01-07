output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "uploads_bucket" {
  description = "S3 bucket for uploads"
  value       = aws_s3_bucket.uploads.id
}

output "artifacts_bucket" {
  description = "S3 bucket for artifacts"
  value       = aws_s3_bucket.artifacts.id
}

output "sessions_table" {
  description = "DynamoDB sessions table"
  value       = aws_dynamodb_table.sessions.name
}

output "messages_table" {
  description = "DynamoDB messages table"
  value       = aws_dynamodb_table.messages.name
}

output "projects_table" {
  description = "DynamoDB projects table"
  value       = aws_dynamodb_table.projects.name
}

output "lambda_role_arn" {
  description = "Lambda execution role ARN"
  value       = aws_iam_role.lambda_execution.arn
}

output "chat_stream_url" {
  description = "Lambda Function URL for streaming chat"
  value       = aws_lambda_function_url.chat_stream.function_url
}
