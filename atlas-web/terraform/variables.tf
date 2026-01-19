variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "atlas"
}

# Optional: Knowledge Core endpoints (local containers)
variable "neo4j_url" {
  description = "Neo4j bolt URL (optional, for local knowledge core)"
  type        = string
  default     = ""
}

variable "opensearch_url" {
  description = "OpenSearch URL (optional, for local knowledge core)"
  type        = string
  default     = ""
}

variable "cors_origin" {
  description = "CORS origin for API responses (set to your frontend URL in production)"
  type        = string
  default     = "https://d2e9zue1tj9oj5.cloudfront.net"
}

variable "allow_dev_auth" {
  description = "Allow X-User-Id header authentication for local development (set to 'true' to enable)"
  type        = string
  default     = "true"
}
