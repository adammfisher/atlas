# Lambda layer for shared dependencies
resource "aws_lambda_layer_version" "common" {
  filename            = "${path.module}/../lambda/layers/common.zip"
  layer_name          = "${var.project_name}-common-layer"
  compatible_runtimes = ["nodejs20.x"]
  description         = "Common dependencies for Atlas Lambda functions"
  source_code_hash    = filebase64sha256("${path.module}/../lambda/layers/common.zip")
}

# Chat function (non-streaming handler)
resource "aws_lambda_function" "chat" {
  filename         = "${path.module}/../lambda/chat.zip"
  function_name    = "${var.project_name}-chat"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/chat.zip")
  runtime          = "nodejs20.x"
  timeout          = 300 # 5 minutes for streaming
  memory_size      = 1024

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      SESSIONS_TABLE        = aws_dynamodb_table.sessions.name
      MESSAGES_TABLE        = aws_dynamodb_table.messages.name
      PROJECTS_TABLE        = aws_dynamodb_table.projects.name
      PROJECT_FILES_TABLE   = aws_dynamodb_table.project_files.name
      PROJECT_MEMORY_TABLE  = aws_dynamodb_table.project_memory.name
      ARTIFACTS_TABLE       = aws_dynamodb_table.artifacts.name
      SUMMARIES_TABLE       = aws_dynamodb_table.summaries.name
      UPLOADS_BUCKET        = aws_s3_bucket.uploads.id
      ARTIFACTS_BUCKET      = aws_s3_bucket.artifacts.id
      VECTORS_BUCKET        = local.vectors_bucket_name
      NEO4J_URL             = var.neo4j_url
      OPENSEARCH_URL        = var.opensearch_url
      JWT_SECRET            = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# Chat streaming function with Lambda Response Streaming
resource "aws_lambda_function" "chat_stream" {
  filename         = "${path.module}/../lambda/chat.zip"
  function_name    = "${var.project_name}-chat-stream"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.streamHandler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/chat.zip")
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 1024

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      SESSIONS_TABLE        = aws_dynamodb_table.sessions.name
      MESSAGES_TABLE        = aws_dynamodb_table.messages.name
      PROJECTS_TABLE        = aws_dynamodb_table.projects.name
      PROJECT_FILES_TABLE   = aws_dynamodb_table.project_files.name
      PROJECT_MEMORY_TABLE  = aws_dynamodb_table.project_memory.name
      ARTIFACTS_TABLE       = aws_dynamodb_table.artifacts.name
      SUMMARIES_TABLE       = aws_dynamodb_table.summaries.name
      UPLOADS_BUCKET        = aws_s3_bucket.uploads.id
      ARTIFACTS_BUCKET      = aws_s3_bucket.artifacts.id
      VECTORS_BUCKET        = local.vectors_bucket_name
      NEO4J_URL             = var.neo4j_url
      OPENSEARCH_URL        = var.opensearch_url
      JWT_SECRET            = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# Lambda Function URL for streaming (supports response streaming)
resource "aws_lambda_function_url" "chat_stream" {
  function_name      = aws_lambda_function.chat_stream.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins     = ["https://d2e9zue1tj9oj5.cloudfront.net", "http://localhost:3000"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    allow_credentials = true
    max_age           = 86400
  }
}

# Sessions function
resource "aws_lambda_function" "sessions" {
  filename         = "${path.module}/../lambda/functions/sessions.zip"
  function_name    = "${var.project_name}-sessions"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/sessions.zip")
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      SESSIONS_TABLE   = aws_dynamodb_table.sessions.name
      MESSAGES_TABLE   = aws_dynamodb_table.messages.name
      ARTIFACTS_TABLE  = aws_dynamodb_table.artifacts.name
      ARTIFACTS_BUCKET = aws_s3_bucket.artifacts.id
      JWT_SECRET       = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# Projects function
resource "aws_lambda_function" "projects" {
  filename         = "${path.module}/../lambda/functions/projects.zip"
  function_name    = "${var.project_name}-projects"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/projects.zip")
  runtime          = "nodejs20.x"
  timeout          = 120  # Increased for memory generation
  memory_size      = 512

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      PROJECTS_TABLE        = aws_dynamodb_table.projects.name
      PROJECT_FILES_TABLE   = aws_dynamodb_table.project_files.name
      PROJECT_MEMORY_TABLE  = aws_dynamodb_table.project_memory.name
      SESSIONS_TABLE        = aws_dynamodb_table.sessions.name
      MESSAGES_TABLE        = aws_dynamodb_table.messages.name
      UPLOADS_BUCKET        = aws_s3_bucket.uploads.id
      VECTORS_BUCKET        = local.vectors_bucket_name
      JWT_SECRET            = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# Files function
resource "aws_lambda_function" "files" {
  filename         = "${path.module}/../lambda/functions/files.zip"
  function_name    = "${var.project_name}-files"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/files.zip")
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 512

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      UPLOADS_BUCKET   = aws_s3_bucket.uploads.id
      ARTIFACTS_BUCKET = aws_s3_bucket.artifacts.id
      JWT_SECRET       = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# MCP Config function
resource "aws_lambda_function" "mcp_config" {
  filename         = "${path.module}/../lambda/functions/mcp-config.zip"
  function_name    = "${var.project_name}-mcp-config"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/mcp-config.zip")
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      MCP_CONFIGS_TABLE = aws_dynamodb_table.mcp_configs.name
      JWT_SECRET        = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# Artifacts function
resource "aws_lambda_function" "artifacts" {
  filename         = "${path.module}/../lambda/functions/artifacts.zip"
  function_name    = "${var.project_name}-artifacts"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/artifacts.zip")
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 512

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      ARTIFACTS_TABLE  = aws_dynamodb_table.artifacts.name
      ARTIFACTS_BUCKET = aws_s3_bucket.artifacts.id
      JWT_SECRET       = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "chat_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "sessions_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sessions.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "projects_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.projects.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "files_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.files.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "mcp_config_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mcp_config.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "artifacts_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.artifacts.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Auth function
resource "aws_lambda_function" "auth" {
  filename         = "${path.module}/../lambda/functions/auth.zip"
  function_name    = "${var.project_name}-auth"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/auth.zip")
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      USERS_TABLE = aws_dynamodb_table.users.name
      JWT_SECRET  = data.aws_ssm_parameter.jwt_secret.value
      CORS_ORIGIN = var.cors_origin
    }
  }
}

resource "aws_lambda_permission" "auth_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Memory Processor function (background processing for vector memory)
resource "aws_lambda_function" "memory_processor" {
  filename         = "${path.module}/../lambda/functions/memory-processor.zip"
  function_name    = "${var.project_name}-memory-processor"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../lambda/functions/memory-processor.zip")
  runtime          = "nodejs20.x"
  timeout          = 300 # 5 minutes for processing large conversations
  memory_size      = 1024

  layers = [aws_lambda_layer_version.common.arn]

  environment {
    variables = {
      SESSIONS_TABLE   = aws_dynamodb_table.sessions.name
      MESSAGES_TABLE   = aws_dynamodb_table.messages.name
      PROJECTS_TABLE   = aws_dynamodb_table.projects.name
      VECTORS_BUCKET   = local.vectors_bucket_name
      JWT_SECRET       = data.aws_ssm_parameter.jwt_secret.value
    }
  }
}
