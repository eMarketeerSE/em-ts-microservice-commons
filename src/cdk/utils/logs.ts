/**
 * CloudWatch log group configuration utilities
 */

import { RemovalPolicy } from 'aws-cdk-lib'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { LogGroupConfig, Stage } from '../types'
import { generateLogGroupName } from './naming'

/**
 * Get retention days based on stage
 */
export const getLogRetentionDays = (stage: Stage): RetentionDays => {
  switch (stage) {
    case 'prod':
      return RetentionDays.ONE_MONTH
    case 'staging':
      return RetentionDays.TWO_WEEKS
    case 'test':
      return RetentionDays.ONE_WEEK
    case 'dev':
      return RetentionDays.THREE_DAYS
    default:
      return RetentionDays.ONE_WEEK
  }
}

/**
 * Convert retention days number to RetentionDays enum
 */
export const convertRetentionDays = (days?: number): RetentionDays | undefined => {
  if (days === undefined || days === null) return undefined

  if (typeof (RetentionDays as Record<number, string | undefined>)[days] !== 'string') {
    const supported = Object.values(RetentionDays)
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b)
      .join(', ')
    throw new Error(`Unsupported logRetentionDays value: ${days}. Supported values: ${supported}`)
  }
  return days as RetentionDays
}

/**
 * Create a CloudWatch log group with standard configuration
 */
export const createLogGroup = (scope: Construct, id: string, config: LogGroupConfig): LogGroup => {
  const retentionDays = config.retentionDays
    ? convertRetentionDays(config.retentionDays)
    : getLogRetentionDays(config.stage)

  return new LogGroup(scope, id, {
    logGroupName: config.logGroupName,
    retention: retentionDays,
    removalPolicy: config.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
  })
}

/**
 * Create an API Gateway log group
 */
export const createApiGatewayLogGroup = (
  scope: Construct,
  id: string,
  stage: Stage,
  serviceName: string,
  apiName: string,
  retentionDays?: number
): LogGroup => {
  const logGroupName = `/aws/apigateway/${generateLogGroupName(stage, serviceName, apiName)}`

  return createLogGroup(scope, id, {
    logGroupName,
    stage,
    retentionDays
  })
}

/**
 * Get removal policy based on stage
 */
export const getRemovalPolicy = (stage: Stage): RemovalPolicy => {
  return stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
}
