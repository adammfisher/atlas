const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand, 
  QueryCommand,
  BatchWriteCommand
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Get a single item
 */
async function getItem(tableName, key) {
  const response = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: key
  }));
  return response.Item;
}

/**
 * Put an item
 */
async function putItem(tableName, item) {
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: item
  }));
  return item;
}

/**
 * Update an item
 */
async function updateItem(tableName, key, updates) {
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.entries(updates).forEach(([field, value], index) => {
    const nameKey = `#field${index}`;
    const valueKey = `:value${index}`;
    updateExpressions.push(`${nameKey} = ${valueKey}`);
    expressionAttributeNames[nameKey] = field;
    expressionAttributeValues[valueKey] = value;
  });

  const response = await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  return response.Attributes;
}

/**
 * Delete an item
 */
async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: key
  }));
}

/**
 * Query items
 */
async function queryItems(tableName, keyCondition, options = {}) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: keyCondition.expression,
    ExpressionAttributeValues: keyCondition.values,
    ScanIndexForward: options.ascending ?? true
  };

  if (keyCondition.names) {
    params.ExpressionAttributeNames = keyCondition.names;
  }

  if (options.indexName) {
    params.IndexName = options.indexName;
  }

  if (options.limit) {
    params.Limit = options.limit;
  }

  const response = await docClient.send(new QueryCommand(params));
  return response.Items || [];
}

/**
 * Batch delete items
 */
async function batchDeleteItems(tableName, keys) {
  if (keys.length === 0) return;

  // DynamoDB batch write has a limit of 25 items
  const chunks = [];
  for (let i = 0; i < keys.length; i += 25) {
    chunks.push(keys.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const deleteRequests = chunk.map(key => ({
      DeleteRequest: { Key: key }
    }));

    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: deleteRequests
      }
    }));
  }
}

module.exports = {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  queryItems,
  batchDeleteItems
};
