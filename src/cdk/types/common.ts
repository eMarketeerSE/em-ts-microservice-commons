/**
 * Common type definitions for CDK constructs and utilities
 */

import { Duration, Tags } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { AttributeType, BillingMode, ProjectionType } from 'aws-cdk-lib/aws-dynamodb'

/**
 * Supported deployment stages
 */
export type Stage = 'dev' | 'test' | 'staging' | 'prod'

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  readonly stage: Stage
  readonly account?: string
  readonly region?: string
  readonly tags?: Record<string, string>
}

/**
 * Base configuration for all constructs
 */
export interface BaseConstructConfig {
  readonly stage: Stage
  readonly serviceName: string
  readonly tags?: Record<string, string>
  readonly enableTracing?: boolean
}

/**
 * Lambda function configuration
 */
export interface LambdaConfig extends BaseConstructConfig {
  readonly functionName: string
  readonly handler: string
  readonly codePath: string
  readonly runtime?: Runtime
  readonly memorySize?: number
  readonly timeout?: Duration
  readonly environment?: Record<string, string>
  readonly reservedConcurrentExecutions?: number
  readonly retryAttempts?: number
  readonly logRetentionDays?: number
}

/**
 * DynamoDB table configuration
 */
export interface DynamoDBTableConfig extends BaseConstructConfig {
  readonly tableName: string
  readonly partitionKey: {
    name: string
    type: AttributeType
  }
  readonly sortKey?: {
    name: string
    type: AttributeType
  }
  readonly billingMode?: BillingMode
  readonly pointInTimeRecovery?: boolean
  readonly stream?: boolean
  readonly timeToLiveAttribute?: string
  readonly globalSecondaryIndexes?: DynamoDBGSIConfig[]
}

/**
 * DynamoDB Global Secondary Index configuration
 */
export interface DynamoDBGSIConfig {
  readonly indexName: string
  readonly partitionKey: {
    name: string
    type: AttributeType
  }
  readonly sortKey?: {
    name: string
    type: AttributeType
  }
  readonly projectionType?: ProjectionType
  readonly nonKeyAttributes?: string[]
}

/**
 * API Gateway REST API configuration
 */
export interface RestApiConfig extends BaseConstructConfig {
  readonly apiName: string
  readonly description?: string
  readonly deployOptions?: {
    stageName?: string
    throttleRateLimit?: number
    throttleBurstLimit?: number
    loggingLevel?: string
    dataTraceEnabled?: boolean
    metricsEnabled?: boolean
  }
  readonly defaultCorsOptions?: {
    allowOrigins: string[]
    allowMethods?: string[]
    allowHeaders?: string[]
    allowCredentials?: boolean
  }
}

/**
 * API Gateway HTTP API configuration
 */
export interface HttpApiConfig extends BaseConstructConfig {
  readonly apiName: string
  readonly description?: string
  readonly corsOptions?: {
    allowOrigins: string[]
    allowMethods?: string[]
    allowHeaders?: string[]
    allowCredentials?: boolean
    maxAge?: Duration
  }
  readonly throttle?: {
    rateLimit?: number
    burstLimit?: number
  }
}

/**
 * SQS Queue configuration
 */
export interface SqsQueueConfig extends BaseConstructConfig {
  readonly queueName: string
  readonly visibilityTimeout?: Duration
  readonly retentionPeriod?: Duration
  readonly receiveMessageWaitTime?: Duration
  readonly enableDLQ?: boolean
  readonly maxReceiveCount?: number
  readonly dlqRetentionPeriod?: Duration
  readonly fifo?: boolean
  readonly contentBasedDeduplication?: boolean
}

/**
 * SNS Topic configuration
 */
export interface SnsTopicConfig extends BaseConstructConfig {
  readonly topicName: string
  readonly displayName?: string
  readonly fifo?: boolean
  readonly contentBasedDeduplication?: boolean
}

/**
 * EventBridge Rule configuration
 */
export interface EventBridgeRuleConfig extends BaseConstructConfig {
  readonly ruleName: string
  readonly description?: string
  readonly eventPattern?: Record<string, any>
  readonly schedule?: string
  readonly enabled?: boolean
}

/**
 * IAM Role configuration
 */
export interface IamRoleConfig {
  readonly roleName: string
  readonly stage: Stage
  readonly serviceName: string
  readonly assumedBy: string
  readonly managedPolicies?: string[]
  readonly inlinePolicies?: Record<string, any>
}

/**
 * CloudWatch Log Group configuration
 */
export interface LogGroupConfig {
  readonly logGroupName: string
  readonly retentionDays?: number
  readonly stage: Stage
}

/**
 * Stack naming configuration
 */
export interface StackNamingConfig {
  readonly stage: Stage
  readonly serviceName: string
  readonly resourceType?: string
  readonly resourceName?: string
}

/**
 * Tagging strategy configuration
 */
export interface TaggingConfig {
  readonly stage: Stage
  readonly serviceName: string
  readonly owner?: string
  readonly costCenter?: string
  readonly project?: string
  readonly customTags?: Record<string, string>
}
