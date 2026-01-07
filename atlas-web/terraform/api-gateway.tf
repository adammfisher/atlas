# HTTP API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"] # Restrict in production
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-User-Id"]
    max_age       = 3600
  }
}

# API Gateway stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }
}

# CloudWatch log group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-api"
  retention_in_days = 14
}

# ============ Chat Routes ============
resource "aws_apigatewayv2_integration" "chat" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.chat.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "chat_stream" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/chat/message/stream"
  target    = "integrations/${aws_apigatewayv2_integration.chat.id}"
}

resource "aws_apigatewayv2_route" "chat_with_files" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/chat/message/with-files/stream"
  target    = "integrations/${aws_apigatewayv2_integration.chat.id}"
}

resource "aws_apigatewayv2_route" "chat_message" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/chat/message"
  target    = "integrations/${aws_apigatewayv2_integration.chat.id}"
}

# ============ Sessions Routes ============
resource "aws_apigatewayv2_integration" "sessions" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sessions.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "sessions_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/sessions"
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}

resource "aws_apigatewayv2_route" "sessions_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/sessions/{sessionId}"
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}

resource "aws_apigatewayv2_route" "sessions_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/sessions"
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}

resource "aws_apigatewayv2_route" "sessions_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /api/sessions/{sessionId}"
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}

resource "aws_apigatewayv2_route" "sessions_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/sessions/{sessionId}"
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}

resource "aws_apigatewayv2_route" "sessions_messages" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/sessions/{sessionId}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}

# ============ Projects Routes ============
resource "aws_apigatewayv2_integration" "projects" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.projects.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "projects_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/projects"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/projects/{projectId}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/projects"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /api/projects/{projectId}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/projects/{projectId}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "project_files_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/projects/{projectId}/files"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "project_files_upload" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/projects/{projectId}/files"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "project_files_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/projects/{projectId}/files/{fileId}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

# ============ Files Routes ============
resource "aws_apigatewayv2_integration" "files" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.files.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "files_presign" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/files/presign"
  target    = "integrations/${aws_apigatewayv2_integration.files.id}"
}

resource "aws_apigatewayv2_route" "files_download" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/files/{fileKey+}"
  target    = "integrations/${aws_apigatewayv2_integration.files.id}"
}

# ============ MCP Config Routes ============
resource "aws_apigatewayv2_integration" "mcp_config" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.mcp_config.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "mcp_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/mcp/servers"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

resource "aws_apigatewayv2_route" "mcp_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/mcp/servers"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

resource "aws_apigatewayv2_route" "mcp_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /api/mcp/servers/{serverId}"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

resource "aws_apigatewayv2_route" "mcp_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/mcp/servers/{serverId}"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

resource "aws_apigatewayv2_route" "connectors_available" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/connectors/available"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

resource "aws_apigatewayv2_route" "mcp_tools" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/mcp/tools"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

resource "aws_apigatewayv2_route" "mcp_execute" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/mcp/execute"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_config.id}"
}

# ============ Artifacts Routes ============
resource "aws_apigatewayv2_integration" "artifacts" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.artifacts.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "artifacts_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/artifacts"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}

resource "aws_apigatewayv2_route" "artifacts_session" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/sessions/{sessionId}/artifacts"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}

resource "aws_apigatewayv2_route" "artifacts_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/artifacts/{artifactId}"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}

resource "aws_apigatewayv2_route" "artifacts_content" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/artifacts/{artifactId}/content"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}

resource "aws_apigatewayv2_route" "artifacts_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/artifacts"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}

resource "aws_apigatewayv2_route" "artifacts_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PATCH /api/artifacts/{artifactId}"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}

resource "aws_apigatewayv2_route" "artifacts_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/artifacts/{artifactId}"
  target    = "integrations/${aws_apigatewayv2_integration.artifacts.id}"
}
