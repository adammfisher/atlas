const { S3VectorsClient, ListIndexesCommand, DeleteIndexCommand } = require('@aws-sdk/client-s3vectors');

const BUCKET_NAME = 'atlas-memory-vectors';

async function clearVectors() {
  const client = new S3VectorsClient({ region: 'us-east-1' });

  try {
    const listCmd = new ListIndexesCommand({ vectorBucketName: BUCKET_NAME });
    const response = await client.send(listCmd);

    if (!response.indexes || response.indexes.length === 0) {
      console.log('No indexes found in S3 Vectors bucket');
      return;
    }

    console.log('Found', response.indexes.length, 'indexes');

    for (const index of response.indexes) {
      console.log('Deleting index:', index.indexName);
      try {
        const deleteCmd = new DeleteIndexCommand({
          vectorBucketName: BUCKET_NAME,
          indexName: index.indexName
        });
        await client.send(deleteCmd);
        console.log('  Deleted:', index.indexName);
      } catch (err) {
        console.log('  Error deleting', index.indexName, ':', err.message);
      }
    }

    console.log('Done clearing S3 Vectors');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

clearVectors();
