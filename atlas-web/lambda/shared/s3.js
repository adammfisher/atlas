const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({});

/**
 * Get a presigned URL for upload
 */
async function getUploadUrl(bucket, key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });
  
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a presigned URL for download
 */
async function getDownloadUrl(bucket, key, expiresIn = 3600, filename = null) {
  const params = {
    Bucket: bucket,
    Key: key
  };
  
  if (filename) {
    params.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }
  
  const command = new GetObjectCommand(params);
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Upload content to S3
 */
async function uploadContent(bucket, key, content, contentType) {
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType
  }));
  
  return { bucket, key };
}

/**
 * Get object content from S3
 */
async function getContent(bucket, key) {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  
  return {
    content: await response.Body.transformToString(),
    contentType: response.ContentType,
    contentLength: response.ContentLength
  };
}

/**
 * Get object as buffer
 */
async function getContentAsBuffer(bucket, key) {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  
  return {
    content: await response.Body.transformToByteArray(),
    contentType: response.ContentType,
    contentLength: response.ContentLength
  };
}

/**
 * Delete object from S3
 */
async function deleteObject(bucket, key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  }));
}

/**
 * Get content type from filename
 */
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'html': 'text/html',
    'json': 'application/json',
    // Code
    'js': 'text/javascript',
    'jsx': 'text/javascript',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'css': 'text/css',
    // Archives
    'zip': 'application/zip'
  };
  return types[ext] || 'application/octet-stream';
}

module.exports = {
  getUploadUrl,
  getDownloadUrl,
  uploadContent,
  getContent,
  getContentAsBuffer,
  deleteObject,
  deleteContent: deleteObject, // Alias for consistency
  getContentType
};
