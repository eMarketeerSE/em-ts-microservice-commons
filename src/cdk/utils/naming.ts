/**
 * Stack naming conventions and utilities
 */

import { StackNamingConfig, Stage } from '../types'

/**
 * Generate a standardized stack name
 * Format: {stage}-{serviceName}-stack
 */
export const generateStackName = (config: StackNamingConfig): string => {
  const { stage, serviceName } = config
  return `${stage}-${serviceName}-stack`
}

/**
 * Generate a standardized resource name
 * Format: {stage}-{serviceName}-{resourceType}-{resourceName}
 */
export const generateResourceName = (config: StackNamingConfig): string => {
  const { stage, serviceName, resourceType, resourceName } = config

  const parts = [stage, serviceName]

  if (resourceType) {
    parts.push(resourceType)
  }

  if (resourceName) {
    parts.push(resourceName)
  }

  return parts.join('-')
}

/**
 * Generate a standardized Lambda function name
 */
export const generateLambdaName = (
  stage: Stage,
  serviceName: string,
  functionName: string
): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'lambda',
    resourceName: functionName
  })
}

/**
 * Generate a standardized DynamoDB table name
 */
export const generateTableName = (stage: Stage, serviceName: string, tableName: string): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'table',
    resourceName: tableName
  })
}

/**
 * Generate a standardized API Gateway name
 */
export const generateApiName = (stage: Stage, serviceName: string, apiName: string): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'api',
    resourceName: apiName
  })
}

/**
 * Generate a standardized SQS queue name
 */
export const generateQueueName = (stage: Stage, serviceName: string, queueName: string): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'queue',
    resourceName: queueName
  })
}

/**
 * Generate a standardized SNS topic name
 */
export const generateTopicName = (stage: Stage, serviceName: string, topicName: string): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'topic',
    resourceName: topicName
  })
}

/**
 * Generate a standardized EventBridge rule name
 */
export const generateRuleName = (stage: Stage, serviceName: string, ruleName: string): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'rule',
    resourceName: ruleName
  })
}

/**
 * Generate a standardized log group name
 */
export const generateLogGroupName = (
  stage: Stage,
  serviceName: string,
  resourceName: string
): string => {
  return `/aws/${stage}/${serviceName}/${resourceName}`
}

/**
 * Generate a standardized IAM role name
 */
export const generateRoleName = (stage: Stage, serviceName: string, roleName: string): string => {
  return generateResourceName({
    stage,
    serviceName,
    resourceType: 'role',
    resourceName: roleName
  })
}

/**
 * Validate stage value
 */
export const isValidStage = (stage: string): stage is Stage => {
  return ['dev', 'test', 'staging', 'prod'].includes(stage)
}

/**
 * Convert stage to uppercase for environment variables
 */
export const stageToUpperCase = (stage: Stage): string => {
  return stage.toUpperCase()
}
