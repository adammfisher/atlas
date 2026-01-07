const JSZip = require('jszip');

// Supported file types for extraction and analysis
const SUPPORTED_TYPES = {
  // Images (will be sent to Claude for vision analysis)
  'jpg': { mime: 'image/jpeg', category: 'image' },
  'jpeg': { mime: 'image/jpeg', category: 'image' },
  'png': { mime: 'image/png', category: 'image' },
  'gif': { mime: 'image/gif', category: 'image' },
  'webp': { mime: 'image/webp', category: 'image' },
  // Documents
  'pdf': { mime: 'application/pdf', category: 'document' },
  'txt': { mime: 'text/plain', category: 'text' },
  'md': { mime: 'text/markdown', category: 'text' },
  'html': { mime: 'text/html', category: 'text' },
  'csv': { mime: 'text/csv', category: 'text' },
  'json': { mime: 'application/json', category: 'text' },
  // Code files
  'js': { mime: 'text/javascript', category: 'code' },
  'jsx': { mime: 'text/javascript', category: 'code' },
  'ts': { mime: 'text/typescript', category: 'code' },
  'tsx': { mime: 'text/typescript', category: 'code' },
  'py': { mime: 'text/x-python', category: 'code' },
  'java': { mime: 'text/x-java-source', category: 'code' },
  'css': { mime: 'text/css', category: 'code' },
  'scss': { mime: 'text/x-scss', category: 'code' },
  'xml': { mime: 'application/xml', category: 'text' },
  'yaml': { mime: 'text/yaml', category: 'text' },
  'yml': { mime: 'text/yaml', category: 'text' },
};

// Files/directories to skip during extraction
const SKIP_PATTERNS = [
  /^__MACOSX\//,
  /\.DS_Store$/,
  /^\.git\//,
  /^node_modules\//,
  /\.pyc$/,
  /^\.env/,
  /Thumbs\.db$/,
];

// Maximum file size to extract (10MB per file)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum total extracted size (50MB)
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

/**
 * Check if a file should be skipped
 */
function shouldSkip(filename) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filename));
}

/**
 * Get file extension
 */
function getExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Check if file type is supported for analysis
 */
function isSupportedType(filename) {
  const ext = getExtension(filename);
  return ext in SUPPORTED_TYPES;
}

/**
 * Get file info for a supported file
 */
function getFileInfo(filename) {
  const ext = getExtension(filename);
  return SUPPORTED_TYPES[ext] || { mime: 'application/octet-stream', category: 'unknown' };
}

/**
 * Extract and analyze a zip file
 * @param {Buffer|Uint8Array|string} zipData - The zip file data (Buffer, Uint8Array, or base64 string)
 * @param {Object} options - Extraction options
 * @param {boolean} options.includeImages - Include image files (default: true)
 * @param {boolean} options.includeCode - Include code files (default: true)
 * @param {boolean} options.includeText - Include text files (default: true)
 * @param {number} options.maxFiles - Maximum number of files to extract (default: 50)
 * @returns {Promise<Object>} Extracted files and metadata
 */
async function extractZip(zipData, options = {}) {
  const {
    includeImages = true,
    includeCode = true,
    includeText = true,
    maxFiles = 50
  } = options;

  // Convert base64 to buffer if needed
  let data = zipData;
  if (typeof zipData === 'string') {
    data = Buffer.from(zipData, 'base64');
  }

  const zip = await JSZip.loadAsync(data);
  const extractedFiles = [];
  const skippedFiles = [];
  let totalSize = 0;
  let fileCount = 0;

  // Get all file entries
  const entries = Object.entries(zip.files);

  for (const [path, file] of entries) {
    // Skip directories
    if (file.dir) continue;

    // Skip system files and hidden directories
    if (shouldSkip(path)) {
      skippedFiles.push({ path, reason: 'system_file' });
      continue;
    }

    // Skip unsupported file types
    if (!isSupportedType(path)) {
      skippedFiles.push({ path, reason: 'unsupported_type' });
      continue;
    }

    // Get file info
    const fileInfo = getFileInfo(path);

    // Check category filter
    if (fileInfo.category === 'image' && !includeImages) {
      skippedFiles.push({ path, reason: 'filtered_by_options' });
      continue;
    }
    if (fileInfo.category === 'code' && !includeCode) {
      skippedFiles.push({ path, reason: 'filtered_by_options' });
      continue;
    }
    if ((fileInfo.category === 'text' || fileInfo.category === 'document') && !includeText) {
      skippedFiles.push({ path, reason: 'filtered_by_options' });
      continue;
    }

    // Check file count limit
    if (fileCount >= maxFiles) {
      skippedFiles.push({ path, reason: 'max_files_exceeded' });
      continue;
    }

    try {
      // Get file content
      const content = await file.async('uint8array');

      // Check individual file size
      if (content.length > MAX_FILE_SIZE) {
        skippedFiles.push({ path, reason: 'file_too_large', size: content.length });
        continue;
      }

      // Check total size
      if (totalSize + content.length > MAX_TOTAL_SIZE) {
        skippedFiles.push({ path, reason: 'total_size_exceeded' });
        continue;
      }

      totalSize += content.length;
      fileCount++;

      // Convert to base64 for API transmission
      const base64 = Buffer.from(content).toString('base64');

      extractedFiles.push({
        name: path.split('/').pop(), // Just the filename
        path: path, // Full path within zip
        type: fileInfo.mime,
        category: fileInfo.category,
        size: content.length,
        base64: base64
      });

    } catch (error) {
      console.error(`Failed to extract ${path}:`, error);
      skippedFiles.push({ path, reason: 'extraction_error', error: error.message });
    }
  }

  return {
    success: true,
    extractedCount: extractedFiles.length,
    skippedCount: skippedFiles.length,
    totalSize,
    files: extractedFiles,
    skipped: skippedFiles,
    summary: generateSummary(extractedFiles, skippedFiles)
  };
}

/**
 * Generate a human-readable summary of the extraction
 */
function generateSummary(extracted, skipped) {
  const categories = {};
  for (const file of extracted) {
    categories[file.category] = (categories[file.category] || 0) + 1;
  }

  const parts = [];
  if (categories.image) parts.push(`${categories.image} image${categories.image > 1 ? 's' : ''}`);
  if (categories.code) parts.push(`${categories.code} code file${categories.code > 1 ? 's' : ''}`);
  if (categories.text) parts.push(`${categories.text} text file${categories.text > 1 ? 's' : ''}`);
  if (categories.document) parts.push(`${categories.document} document${categories.document > 1 ? 's' : ''}`);

  let summary = `Extracted ${extracted.length} file${extracted.length !== 1 ? 's' : ''}`;
  if (parts.length > 0) {
    summary += ` (${parts.join(', ')})`;
  }
  if (skipped.length > 0) {
    summary += `. Skipped ${skipped.length} file${skipped.length !== 1 ? 's' : ''}.`;
  }

  return summary;
}

/**
 * Check if a file is a zip file based on content type or filename
 */
function isZipFile(file) {
  if (file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed' ||
      file.type === 'application/x-zip') {
    return true;
  }
  if (file.name && file.name.toLowerCase().endsWith('.zip')) {
    return true;
  }
  return false;
}

/**
 * Process files array, extracting any zip files
 * @param {Array} files - Array of file objects with name, type, base64
 * @returns {Promise<Object>} Processed files with zip contents expanded
 */
async function processFilesWithZipExtraction(files) {
  const processedFiles = [];
  const zipResults = [];

  for (const file of files) {
    if (isZipFile(file)) {
      try {
        const result = await extractZip(file.base64);
        zipResults.push({
          zipName: file.name,
          ...result
        });
        // Add extracted files to processed list
        for (const extracted of result.files) {
          processedFiles.push({
            name: `${file.name}/${extracted.path}`,
            type: extracted.type,
            base64: extracted.base64,
            fromZip: file.name
          });
        }
      } catch (error) {
        console.error(`Failed to extract zip ${file.name}:`, error);
        zipResults.push({
          zipName: file.name,
          success: false,
          error: error.message
        });
      }
    } else {
      // Pass through non-zip files
      processedFiles.push(file);
    }
  }

  return {
    files: processedFiles,
    zipResults
  };
}

module.exports = {
  extractZip,
  isZipFile,
  processFilesWithZipExtraction,
  isSupportedType,
  getFileInfo,
  SUPPORTED_TYPES,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE
};
