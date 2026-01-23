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
  if (!days) return undefined

  const retentionMap: Record<number, RetentionDays> = {
    1: RetentionDays.ONE_DAY,
    3: RetentionDays.THREE_DAYS,
    5: RetentionDays.FIVE_DAYS,
    7: RetentionDays.ONE_WEEK,
    14: RetentionDays.TWO_WEEKS,
    30: RetentionDays.ONE_MONTH,
    60: RetentionDays.TWO_MONTHS,
    90: RetentionDays.THREE_MONTHS,
    120: RetentionDays.FOUR_MONTHS,
    150: RetentionDays.FIVE_MONTHS,
    180: RetentionDays.SIX_MONTHS,
    365: RetentionDays.ONE_YEAR,
    400: RetentionDays.THIRTEEN_MONTHS,
    545: RetentionDays.EIGHTEEN_MONTHS,
    731: RetentionDays.TWO_YEARS,
    1827: RetentionDays.FIVE_YEARS,
    3653: RetentionDays.TEN_YEARS
  }

  return retentionMap[days]
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
 * Create a Lambda function log group
 */
export const createLambdaLogGroup = (
  scope: Construct,
  id: string,
  stage: Stage,
  serviceName: string,
  functionName: string,
  retentionDays?: number
): LogGroup => {
  const logGroupName = `/aws/lambda/${generateLogGroupName(stage, serviceName, functionName)}`

  return createLogGroup(scope, id, {
    logGroupName,
    stage,
    retentionDays
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

/**
 * Should enable log insights based on stage
 */
export const shouldEnableLogInsights = (stage: Stage): boolean => {
  return stage === 'prod' || stage === 'staging'
}
