/**
 * IAM role and policy generation helpers
 */

import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
  ManagedPolicy
} from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { IamRoleConfig } from '../types'
import { generateRoleName } from './naming'

/**
 * Create a Lambda execution role with standard permissions
 */
export const createLambdaExecutionRole = (
  scope: Construct,
  id: string,
  config: IamRoleConfig
): Role => {
  const roleName = generateRoleName(config.stage, config.serviceName, config.roleName)

  const role = new Role(scope, id, {
    roleName,
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    description: `Lambda execution role for ${config.serviceName}`
  })

  // Add basic Lambda execution permissions
  role.addManagedPolicy(
    ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  )

  // Add VPC execution permissions if needed
  if (config.managedPolicies?.includes('AWSLambdaVPCAccessExecutionRole')) {
    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    )
  }

  return role
}

/**
 * Create a standard Lambda execution policy statement
 */
export const createLambdaExecutionPolicy = (): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    resources: ['*']
  })
}

/**
 * Create a DynamoDB access policy statement
 */
export const createDynamoDBAccessPolicy = (
  tableArn: string,
  actions: string[] = [
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:UpdateItem',
    'dynamodb:DeleteItem',
    'dynamodb:Query',
    'dynamodb:Scan'
  ]
): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions,
    resources: [tableArn, `${tableArn}/index/*`]
  })
}

/**
 * Create a read-only DynamoDB access policy statement
 */
export const createDynamoDBReadPolicy = (tableArn: string): PolicyStatement => {
  return createDynamoDBAccessPolicy(tableArn, [
    'dynamodb:GetItem',
    'dynamodb:Query',
    'dynamodb:Scan',
    'dynamodb:BatchGetItem'
  ])
}

/**
 * Create a write-only DynamoDB access policy statement
 */
export const createDynamoDBWritePolicy = (tableArn: string): PolicyStatement => {
  return createDynamoDBAccessPolicy(tableArn, [
    'dynamodb:PutItem',
    'dynamodb:UpdateItem',
    'dynamodb:DeleteItem',
    'dynamodb:BatchWriteItem'
  ])
}

/**
 * Create an SQS access policy statement
 */
export const createSQSAccessPolicy = (
  queueArn: string,
  actions: string[] = [
    'sqs:SendMessage',
    'sqs:ReceiveMessage',
    'sqs:DeleteMessage',
    'sqs:GetQueueAttributes'
  ]
): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions,
    resources: [queueArn]
  })
}

/**
 * Create an SNS publish policy statement
 */
export const createSNSPublishPolicy = (topicArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['sns:Publish'],
    resources: [topicArn]
  })
}

/**
 * Create an S3 access policy statement
 */
export const createS3AccessPolicy = (
  bucketArn: string,
  actions: string[] = ['s3:GetObject', 's3:PutObject', 's3:DeleteObject']
): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions,
    resources: [bucketArn, `${bucketArn}/*`]
  })
}

/**
 * Create an S3 read-only policy statement
 */
export const createS3ReadPolicy = (bucketArn: string): PolicyStatement => {
  return createS3AccessPolicy(bucketArn, ['s3:GetObject', 's3:ListBucket'])
}

/**
 * Create a Secrets Manager access policy statement
 */
export const createSecretsManagerPolicy = (secretArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
    resources: [secretArn]
  })
}

/**
 * Create a Systems Manager Parameter Store access policy statement
 */
export const createSSMParameterPolicy = (parameterArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
    resources: [parameterArn]
  })
}

/**
 * Create an X-Ray tracing policy statement
 */
export const createXRayTracingPolicy = (): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
    resources: ['*']
  })
}

/**
 * Create an EventBridge put events policy statement
 */
export const createEventBridgePutEventsPolicy = (eventBusArn?: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['events:PutEvents'],
    resources: [eventBusArn || '*']
  })
}

/**
 * Create a CloudWatch Logs policy statement
 */
export const createCloudWatchLogsPolicy = (logGroupArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    resources: [logGroupArn]
  })
}

/**
 * Create a KMS decrypt policy statement
 */
export const createKMSDecryptPolicy = (keyArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['kms:Decrypt', 'kms:DescribeKey'],
    resources: [keyArn]
  })
}

/**
 * Create a Lambda invoke policy statement
 */
export const createLambdaInvokePolicy = (functionArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [functionArn]
  })
}

/**
 * Create a Step Functions start execution policy statement
 */
export const createStepFunctionsExecutionPolicy = (stateMachineArn: string): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['states:StartExecution', 'states:DescribeExecution', 'states:StopExecution'],
    resources: [stateMachineArn]
  })
}

/**
 * Combine multiple policy statements into a policy document
 */
export const createPolicyDocument = (statements: PolicyStatement[]): PolicyDocument => {
  return new PolicyDocument({
    statements
  })
}
