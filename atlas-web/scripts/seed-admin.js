#!/usr/bin/env node
/**
 * Seed script for creating admin user
 * Usage: node scripts/seed-admin.js
 *
 * Environment variables:
 * - AWS_REGION: AWS region (default: us-east-1)
 * - USERS_TABLE: DynamoDB table name (default: atlas-users)
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const readline = require('readline');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.USERS_TABLE || 'atlas-users';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function checkUsernameExists(username) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    return result.Items && result.Items.length > 0;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.error(`Table ${TABLE_NAME} not found. Make sure to run terraform apply first.`);
      process.exit(1);
    }
    throw error;
  }
}

async function checkEmailExists(email) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }));
    return result.Items && result.Items.length > 0;
  } catch (error) {
    throw error;
  }
}

async function main() {
  console.log('\n=== Atlas Admin User Setup ===\n');
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);

  const username = await question('Username: ');
  const email = await question('Email: ');
  const password = await question('Password: ');
  const displayName = await question('Display Name: ');

  // Validate password
  if (password.length < 8) {
    console.error('\nError: Password must be at least 8 characters');
    process.exit(1);
  }

  // Check if username exists
  console.log('\nChecking username availability...');
  if (await checkUsernameExists(username)) {
    console.error('Error: Username already exists');
    process.exit(1);
  }

  // Check if email exists
  console.log('Checking email availability...');
  if (await checkEmailExists(email)) {
    console.error('Error: Email already exists');
    process.exit(1);
  }

  // Create user
  console.log('Creating user...');
  const userId = `usr_${nanoid(12)}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const now = Date.now();

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      username,
      email,
      passwordHash,
      displayName,
      role: 'admin',
      createdAt: now,
      updatedAt: now
    }
  }));

  console.log(`\n=== Admin user created successfully! ===`);
  console.log(`User ID: ${userId}`);
  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
  console.log(`Role: admin`);

  rl.close();
}

main().catch(err => {
  console.error('\nError:', err.message);
  rl.close();
  process.exit(1);
});
