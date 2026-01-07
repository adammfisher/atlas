const { getItem, putItem, updateItem, deleteItem, queryItems, batchDeleteItems } = require('./shared/dynamodb');
const { getUploadUrl, deleteObject, uploadContent } = require('./shared/s3');
const {
  success,
  created,
  noContent,
  badRequest,
  notFound,
  serverError,
  getUserId,
  parseBody,
  getPathParam
} = require('./shared/response');
const { extractZip, isZipFile, isSupportedType } = require('./shared/zip');

const PROJECTS_TABLE = process.env.PROJECTS_TABLE;
const PROJECT_FILES_TABLE = process.env.PROJECT_FILES_TABLE;
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Projects event:', JSON.stringify(event));
  
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  const projectId = getPathParam(event, 'projectId');
  const fileId = getPathParam(event, 'fileId');
  
  try {
    // Route based on method and path
    if (path.includes('/files/upload-zip')) {
      if (method === 'POST') {
        return uploadZipFile(event, projectId);
      }
    } else if (path.includes('/files')) {
      if (method === 'GET') {
        return listProjectFiles(event, projectId);
      } else if (method === 'POST') {
        return uploadProjectFile(event, projectId);
      } else if (method === 'DELETE' && fileId) {
        return deleteProjectFile(event, projectId, fileId);
      }
    } else if (method === 'GET' && projectId) {
      return getProject(event, projectId);
    } else if (method === 'GET') {
      return listProjects(event);
    } else if (method === 'POST') {
      return createProject(event);
    } else if (method === 'PUT' && projectId) {
      return updateProject(event, projectId);
    } else if (method === 'DELETE' && projectId) {
      return deleteProject(event, projectId);
    }
    
    return badRequest('Invalid route');
  } catch (error) {
    console.error('Projects error:', error);
    return serverError(error.message);
  }
};

/**
 * List all projects for user
 */
async function listProjects(event) {
  const userId = getUserId(event);
  
  const projects = await queryItems(PROJECTS_TABLE, {
    expression: 'userId = :userId',
    values: { ':userId': userId }
  });
  
  return success({
    projects: projects.map(p => ({
      id: p.projectId,
      name: p.name,
      description: p.description,
      instructions: p.instructions,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }))
  });
}

/**
 * Get a single project
 */
async function getProject(event, projectId) {
  const userId = getUserId(event);
  
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  
  if (!project) {
    return notFound('Project not found');
  }
  
  // Get file count
  const files = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });
  
  return success({
    id: project.projectId,
    name: project.name,
    description: project.description,
    instructions: project.instructions,
    fileCount: files.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  });
}

/**
 * Create a new project
 */
async function createProject(event) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  if (!body.name) {
    return badRequest('Project name is required');
  }
  
  const projectId = `proj_${Date.now()}`;
  const now = Date.now();
  
  const project = {
    userId,
    projectId,
    name: body.name,
    description: body.description || '',
    instructions: body.instructions || '',
    createdAt: now,
    updatedAt: now
  };
  
  await putItem(PROJECTS_TABLE, project);
  
  return created({
    id: project.projectId,
    name: project.name,
    description: project.description,
    instructions: project.instructions,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  });
}

/**
 * Update a project
 */
async function updateProject(event, projectId) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  // Verify project exists
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }
  
  // Build updates
  const updates = { updatedAt: Date.now() };
  
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.instructions !== undefined) {
    updates.instructions = body.instructions;
  }
  
  const updated = await updateItem(PROJECTS_TABLE, { userId, projectId }, updates);
  
  return success({
    id: updated.projectId,
    name: updated.name,
    description: updated.description,
    instructions: updated.instructions,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
}

/**
 * Delete a project and its files
 */
async function deleteProject(event, projectId) {
  const userId = getUserId(event);
  
  // Verify project exists
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }
  
  // Get all files for this project
  const files = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });
  
  // Delete all files from S3 and DynamoDB
  for (const file of files) {
    try {
      await deleteObject(UPLOADS_BUCKET, file.s3Key);
    } catch (e) {
      console.error(`Failed to delete S3 object ${file.s3Key}:`, e);
    }
  }
  
  if (files.length > 0) {
    const fileKeys = files.map(f => ({
      projectId: f.projectId,
      fileId: f.fileId
    }));
    await batchDeleteItems(PROJECT_FILES_TABLE, fileKeys);
  }
  
  // Delete project
  await deleteItem(PROJECTS_TABLE, { userId, projectId });
  
  return noContent();
}

/**
 * List files in a project
 */
async function listProjectFiles(event, projectId) {
  const userId = getUserId(event);
  
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }
  
  const files = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });
  
  return success({
    projectId,
    files: files.map(f => ({
      id: f.fileId,
      name: f.name,
      type: f.type,
      size: f.size,
      createdAt: f.createdAt
    }))
  });
}

/**
 * Upload a file to a project (returns presigned URL)
 */
async function uploadProjectFile(event, projectId) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }
  
  if (!body.filename || !body.contentType) {
    return badRequest('filename and contentType are required');
  }
  
  const fileId = `file_${Date.now()}`;
  const s3Key = `projects/${projectId}/${fileId}-${body.filename}`;
  
  // Generate presigned upload URL
  const uploadUrl = await getUploadUrl(UPLOADS_BUCKET, s3Key, body.contentType);
  
  // Save file metadata
  const file = {
    projectId,
    fileId,
    name: body.filename,
    type: body.contentType,
    size: body.size || 0,
    s3Key,
    createdAt: Date.now()
  };
  
  await putItem(PROJECT_FILES_TABLE, file);
  
  // Update project timestamp
  await updateItem(PROJECTS_TABLE, { userId, projectId }, { updatedAt: Date.now() });
  
  return success({
    fileId,
    uploadUrl,
    file: {
      id: file.fileId,
      name: file.name,
      type: file.type,
      createdAt: file.createdAt
    }
  });
}

/**
 * Delete a file from a project
 */
async function deleteProjectFile(event, projectId, fileId) {
  const userId = getUserId(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  // Get file
  const file = await getItem(PROJECT_FILES_TABLE, { projectId, fileId });
  if (!file) {
    return notFound('File not found');
  }

  // Delete from S3
  try {
    await deleteObject(UPLOADS_BUCKET, file.s3Key);
  } catch (e) {
    console.error(`Failed to delete S3 object ${file.s3Key}:`, e);
  }

  // Delete from DynamoDB
  await deleteItem(PROJECT_FILES_TABLE, { projectId, fileId });

  // Update project timestamp
  await updateItem(PROJECTS_TABLE, { userId, projectId }, { updatedAt: Date.now() });

  return noContent();
}

/**
 * Upload and extract a zip file to a project
 * This endpoint accepts the zip file content as base64 in the request body
 * and extracts all supported files into the project
 */
async function uploadZipFile(event, projectId) {
  const userId = getUserId(event);
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!body.zipContent) {
    return badRequest('zipContent (base64) is required');
  }

  const zipFilename = body.filename || 'upload.zip';

  try {
    // Extract the zip file
    const result = await extractZip(body.zipContent, {
      includeImages: body.includeImages !== false,
      includeCode: body.includeCode !== false,
      includeText: body.includeText !== false,
      maxFiles: body.maxFiles || 50
    });

    if (!result.success) {
      return badRequest('Failed to extract zip file');
    }

    const uploadedFiles = [];
    const now = Date.now();

    // Upload each extracted file to S3 and save metadata
    for (const file of result.files) {
      const fileId = `file_${now}_${Math.random().toString(36).substr(2, 9)}`;
      const s3Key = `projects/${projectId}/${fileId}-${file.name}`;

      // Upload to S3
      const content = Buffer.from(file.base64, 'base64');
      await uploadContent(UPLOADS_BUCKET, s3Key, content, file.type);

      // Save file metadata
      const fileRecord = {
        projectId,
        fileId,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        s3Key,
        fromZip: zipFilename,
        createdAt: now
      };

      await putItem(PROJECT_FILES_TABLE, fileRecord);

      uploadedFiles.push({
        id: fileId,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        createdAt: now
      });
    }

    // Update project timestamp
    await updateItem(PROJECTS_TABLE, { userId, projectId }, { updatedAt: now });

    return success({
      zipFilename,
      extractedCount: result.extractedCount,
      skippedCount: result.skippedCount,
      summary: result.summary,
      files: uploadedFiles,
      skipped: result.skipped
    });

  } catch (error) {
    console.error('Zip extraction error:', error);
    return serverError(`Failed to process zip file: ${error.message}`);
  }
}
