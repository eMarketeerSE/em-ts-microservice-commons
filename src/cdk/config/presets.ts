/**
 * Preset configurations for common use cases
 */

import { Duration } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb'

/**
 * Lambda function presets
 */
export const LAMBDA_PRESETS = {
  /**
   * Small Lambda (256MB, 15s timeout)
   */
  small: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 256,
    timeout: Duration.seconds(15)
  },

  /**
   * Medium Lambda (512MB, 30s timeout)
   */
  medium: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 512,
    timeout: Duration.seconds(30)
  },

  /**
   * Large Lambda (1024MB, 60s timeout)
   */
  large: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 1024,
    timeout: Duration.seconds(60)
  },

  /**
   * XLarge Lambda (2048MB, 5min timeout)
   */
  xlarge: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 2048,
    timeout: Duration.minutes(5)
  },

  /**
   * API Handler (1024MB, 30s timeout)
   */
  apiHandler: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 1024,
    timeout: Duration.seconds(30)
  },

  /**
   * Queue Processor (1024MB, 5min timeout)
   */
  queueProcessor: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 1024,
    timeout: Duration.minutes(5)
  },

  /**
   * Scheduled Job (2048MB, 15min timeout)
   */
  scheduledJob: {
    runtime: Runtime.NODEJS_22_X,
    memorySize: 2048,
    timeout: Duration.minutes(15)
  }
}

/**
 * DynamoDB table presets
 */
export const DYNAMODB_PRESETS = {
  /**
   * Pay-per-request billing (recommended for most use cases)
   */
  payPerRequest: {
    billingMode: BillingMode.PAY_PER_REQUEST
  },

  /**
   * Provisioned billing with auto-scaling
   */
  provisioned: {
    billingMode: BillingMode.PROVISIONED,
    readCapacity: 5,
    writeCapacity: 5
  },

  /**
   * Single-table design keys
   */
  singleTable: {
    partitionKey: { name: 'PK', type: AttributeType.STRING },
    sortKey: { name: 'SK', type: AttributeType.STRING }
  },

  /**
   * Simple ID-based table
   */
  simpleIdTable: {
    partitionKey: { name: 'id', type: AttributeType.STRING }
  },

  /**
   * Time-series table
   */
  timeSeries: {
    partitionKey: { name: 'entityId', type: AttributeType.STRING },
    sortKey: { name: 'timestamp', type: AttributeType.NUMBER }
  }
}

/**
 * SQS queue presets
 */
export const SQS_PRESETS = {
  /**
   * Standard queue with DLQ
   */
  standard: {
    visibilityTimeout: Duration.seconds(30),
    retentionPeriod: Duration.days(4),
    enableDLQ: true,
    maxReceiveCount: 3
  },

  /**
   * Long-running task queue
   */
  longRunning: {
    visibilityTimeout: Duration.minutes(5),
    retentionPeriod: Duration.days(14),
    enableDLQ: true,
    maxReceiveCount: 3
  },

  /**
   * FIFO queue
   */
  fifo: {
    fifo: true,
    contentBasedDeduplication: true,
    visibilityTimeout: Duration.seconds(30),
    enableDLQ: true,
    maxReceiveCount: 3
  }
}

/**
 * API Gateway CORS presets
 */
export const CORS_PRESETS = {
  /**
   * Allow all origins (development only)
   */
  allowAll: {
    allowOrigins: ['*'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key']
  },

  /**
   * Strict CORS (production)
   */
  strict: (origins: string[]) => ({
    allowOrigins: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowCredentials: true
  }),

  /**
   * Read-only CORS
   */
  readOnly: {
    allowOrigins: ['*'],
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  }
}
