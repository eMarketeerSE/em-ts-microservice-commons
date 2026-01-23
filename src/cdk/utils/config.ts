/**
 * Environment-specific configuration management utilities
 */

import { EnvironmentConfig, Stage } from '../types'

/**
 * Default configuration values by stage
 */
const STAGE_DEFAULTS: Record<Stage, Partial<EnvironmentConfig>> = {
  dev: {
    region: 'eu-west-1',
    tags: {
      Environment: 'development'
    }
  },
  test: {
    region: 'eu-west-1',
    tags: {
      Environment: 'test'
    }
  },
  staging: {
    region: 'eu-west-1',
    tags: {
      Environment: 'staging'
    }
  },
  prod: {
    region: 'eu-west-1',
    tags: {
      Environment: 'production'
    }
  }
}

/**
 * Get environment configuration with defaults
 */
export const getEnvironmentConfig = (
  stage: Stage,
  overrides?: Partial<EnvironmentConfig>
): EnvironmentConfig => {
  const defaults = STAGE_DEFAULTS[stage]
  
  return {
    stage,
    region: overrides?.region || defaults.region || 'eu-west-1',
    account: overrides?.account || process.env.CDK_DEFAULT_ACCOUNT,
    tags: {
      ...defaults.tags,
      ...overrides?.tags
    }
  }
}

/**
 * Get environment variable with stage prefix
 */
export const getStageEnvVar = (stage: Stage, key: string, defaultValue?: string): string | undefined => {
  const stageKey = `${stage.toUpperCase()}_${key}`
  return process.env[stageKey] || process.env[key] || defaultValue
}

/**
 * Get required environment variable
 */
export const getRequiredEnvVar = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value
}

/**
 * Get environment variables for a Lambda function
 */
export const getLambdaEnvironmentVariables = (
  stage: Stage,
  additionalVars?: Record<string, string>
): Record<string, string> => {
  return {
    STAGE: stage,
    NODE_ENV: stage === 'prod' ? 'production' : 'development',
    REGION: process.env.AWS_REGION || 'eu-west-1',
    ...additionalVars
  }
}

/**
 * Check if running in production stage
 */
export const isProduction = (stage: Stage): boolean => {
  return stage === 'prod'
}

/**
 * Check if running in development stage
 */
export const isDevelopment = (stage: Stage): boolean => {
  return stage === 'dev'
}

/**
 * Get stage from environment or default
 */
export const getStageFromEnv = (defaultStage: Stage = 'dev'): Stage => {
  const stage = process.env.STAGE || process.env.CDK_STAGE || defaultStage
  if (!['dev', 'test', 'staging', 'prod'].includes(stage)) {
    throw new Error(`Invalid stage: ${stage}. Must be one of: dev, test, staging, prod`)
  }
  return stage as Stage
}

/**
 * Get stage-specific resource limits
 */
export const getResourceLimits = (stage: Stage) => {
  switch (stage) {
    case 'prod':
      return {
        lambdaMemory: 1024,
        lambdaTimeout: 30,
        apiThrottleRate: 10000,
        apiThrottleBurst: 5000,
        dynamoDbReadCapacity: 5,
        dynamoDbWriteCapacity: 5,
        logRetentionDays: 30
      }
    case 'staging':
      return {
        lambdaMemory: 1024,
        lambdaTimeout: 30,
        apiThrottleRate: 5000,
        apiThrottleBurst: 2500,
        dynamoDbReadCapacity: 3,
        dynamoDbWriteCapacity: 3,
        logRetentionDays: 14
      }
    case 'test':
      return {
        lambdaMemory: 512,
        lambdaTimeout: 15,
        apiThrottleRate: 1000,
        apiThrottleBurst: 500,
        dynamoDbReadCapacity: 1,
        dynamoDbWriteCapacity: 1,
        logRetentionDays: 7
      }
    case 'dev':
      return {
        lambdaMemory: 512,
        lambdaTimeout: 15,
        apiThrottleRate: 100,
        apiThrottleBurst: 50,
        dynamoDbReadCapacity: 1,
        dynamoDbWriteCapacity: 1,
        logRetentionDays: 3
      }
  }
}

/**
 * Get stage-specific tracing configuration
 */
export const getTracingConfig = (stage: Stage) => {
  return {
    enableXRay: stage === 'prod' || stage === 'staging',
    enableLambdaInsights: stage === 'prod' || stage === 'staging',
    enableActiveTracing: stage === 'prod'
  }
}

/**
 * Get stage-specific alarm thresholds
 */
export const getAlarmThresholds = (stage: Stage) => {
  switch (stage) {
    case 'prod':
      return {
        errorRate: 1,
        throttleRate: 5,
        durationP99: 5000,
        concurrentExecutions: 900
      }
    case 'staging':
      return {
        errorRate: 5,
        throttleRate: 10,
        durationP99: 10000,
        concurrentExecutions: 500
      }
    default:
      return {
        errorRate: 10,
        throttleRate: 20,
        durationP99: 15000,
        concurrentExecutions: 100
      }
  }
}
