# ============================================================================
# S3 Vectors Infrastructure for Semantic Memory Storage
# ============================================================================
#
# S3 Vectors is a specialized vector bucket type for storing and querying
# embedding vectors with sub-second search performance.
#
# S3 Vectors became GA in December 2025 and Terraform AWS provider added
# support in v6.24.0 (aws_s3vectors_vector_bucket resource).
#
# Vector indexes are created programmatically by Lambda functions when
# projects are created, as they require per-project isolation.
# ============================================================================

# Local value for consistent bucket naming
locals {
  vectors_bucket_name = "${var.project_name}-memory-vectors"
}

# Create the S3 Vector bucket using native Terraform resource
resource "aws_s3vectors_vector_bucket" "memory_vectors" {
  vector_bucket_name = local.vectors_bucket_name
}

# Output the vector bucket name for Lambda environment variables
output "vectors_bucket_name" {
  description = "Name of the S3 Vectors bucket for memory storage"
  value       = aws_s3vectors_vector_bucket.memory_vectors.vector_bucket_name
}

# Output the ARN from the resource
output "vectors_bucket_arn" {
  description = "ARN of the S3 Vectors bucket"
  value       = aws_s3vectors_vector_bucket.memory_vectors.vector_bucket_arn
}
