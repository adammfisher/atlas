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

  attribute {
    name = "projectId"
    type = "S"
  }

  # GSI for listing sessions by update time
  global_secondary_index {
    name            = "userId-updatedAt-index"
    hash_key        = "userId"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  # GSI for listing sessions by project
  global_secondary_index {
    name            = "projectId-updatedAt-index"
    hash_key        = "projectId"
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

  attribute {
    name = "lastActivityAt"
    type = "N"
  }

  # GSI for listing projects by last activity
  global_secondary_index {
    name            = "userId-lastActivityAt-index"
    hash_key        = "userId"
    range_key       = "lastActivityAt"
    projection_type = "ALL"
  }
}

# Project files table - stores file references for projects
# Enhanced for Projects feature: pinned status, token count, processing status
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

  attribute {
    name = "pinned"
    type = "S"
  }

  # GSI for quickly fetching pinned files for context assembly
  # pinned values: "true" or "false" (stored as string for GSI compatibility)
  global_secondary_index {
    name            = "projectId-pinned-index"
    hash_key        = "projectId"
    range_key       = "pinned"
    projection_type = "ALL"
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

# Project Memory table - stores synthesized memory from conversations
# Memory is versioned to support rollback and audit trail
resource "aws_dynamodb_table" "project_memory" {
  name         = "${var.project_name}-project-memory"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "projectId"
  range_key    = "version"

  attribute {
    name = "projectId"
    type = "S"
  }

  attribute {
    name = "version"
    type = "N"
  }

  # Memory items include:
  # - sections: { purposeContext, currentState, onTheHorizon, keyLearnings, approachPatterns, toolsResources }
  # - processedChatIds: array of session IDs that contributed to this memory
  # - current: boolean indicating this is the latest version
  # - generatedAt: timestamp
  # - tokenCount: estimated tokens for budget tracking
}

# Users table - stores user credentials and profile info
resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  # GSI for lookup by username (login)
  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  # GSI for lookup by email (password reset, uniqueness check)
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  # User items include:
  # - userId: partition key (format: "usr_" + nanoid(12))
  # - username: human-readable login name, unique
  # - email: unique, for future password reset
  # - passwordHash: bcrypt hashed password (cost 12)
  # - displayName: shown in UI
  # - role: "admin" or "user"
  # - createdAt: timestamp
  # - updatedAt: timestamp
}
