# Sessions table - stores conversation metadata
resource "aws_dynamodb_table" "sessions" {
  name         = "${var.project_name}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sessionId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "N"
  }

  # GSI for listing sessions by update time
  global_secondary_index {
    name            = "userId-updatedAt-index"
    hash_key        = "userId"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = false
  }
}

# Messages table - stores conversation messages
resource "aws_dynamodb_table" "messages" {
  name         = "${var.project_name}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"
  range_key    = "messageId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "messageId"
    type = "S"
  }
}

# Projects table - stores project metadata
resource "aws_dynamodb_table" "projects" {
  name         = "${var.project_name}-projects"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "projectId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "projectId"
    type = "S"
  }
}

# Project files table - stores file references for projects
resource "aws_dynamodb_table" "project_files" {
  name         = "${var.project_name}-project-files"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "projectId"
  range_key    = "fileId"

  attribute {
    name = "projectId"
    type = "S"
  }

  attribute {
    name = "fileId"
    type = "S"
  }
}

# MCP configs table - stores user MCP server configurations
resource "aws_dynamodb_table" "mcp_configs" {
  name         = "${var.project_name}-mcp-configs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "serverId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "serverId"
    type = "S"
  }
}

# Artifacts table - stores generated artifact metadata
resource "aws_dynamodb_table" "artifacts" {
  name         = "${var.project_name}-artifacts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"
  range_key    = "artifactId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "artifactId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "N"
  }

  # GSI for listing artifacts by user
  global_secondary_index {
    name            = "userId-createdAt-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
}

# Summaries table - stores compacted conversation summaries for caching
resource "aws_dynamodb_table" "summaries" {
  name         = "${var.project_name}-summaries"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}
