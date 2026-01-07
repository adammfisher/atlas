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
