const { getUploadUrl, getDownloadUrl, getContentType } = require('./shared/s3');
const {
  success,
  badRequest,
  serverError,
  getUserId,
  parseBody,
  getPathParam
} = require('./shared/response');

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Files event:', JSON.stringify(event));
  
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  
  try {
    if (method === 'POST' && path.includes('/presign')) {
      return getPresignedUrl(event);
    } else if (method === 'GET') {
      return downloadFile(event);
    }
    
    return badRequest('Invalid route');
  } catch (error) {
    console.error('Files error:', error);
    return serverError(error.message);
  }
};

/**
 * Get presigned URL for upload
 */
async function getPresignedUrl(event) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  const { filename, contentType, sessionId, purpose = 'upload' } = body;
  
  if (!filename || !contentType) {
    return badRequest('filename and contentType are required');
  }
  
  // Determine bucket and path
  let bucket, key;
  
  if (purpose === 'artifact') {
    bucket = ARTIFACTS_BUCKET;
    key = `${sessionId || 'temp'}/${Date.now()}-${filename}`;
  } else {
    bucket = UPLOADS_BUCKET;
    key = `sessions/${sessionId || 'temp'}/${Date.now()}-${filename}`;
  }
  
  const uploadUrl = await getUploadUrl(bucket, key, contentType);
  
  return success({
    uploadUrl,
    key,
    bucket,
    expiresIn: 3600
  });
}

/**
 * Get download URL for file
 */
async function downloadFile(event) {
  const fileKey = getPathParam(event, 'fileKey');
  
  if (!fileKey) {
    return badRequest('File key is required');
  }
  
  // Decode the key (it may be URL encoded)
  const decodedKey = decodeURIComponent(fileKey);
  
  // Determine bucket based on key pattern
  let bucket;
  if (decodedKey.startsWith('artifacts/') || decodedKey.includes('/art_')) {
    bucket = ARTIFACTS_BUCKET;
  } else {
    bucket = UPLOADS_BUCKET;
  }
  
  // Get filename for download
  const filename = decodedKey.split('/').pop();
  
  const downloadUrl = await getDownloadUrl(bucket, decodedKey, 3600, filename);
  
  return success({
    downloadUrl,
    filename,
    expiresIn: 3600
  });
}
