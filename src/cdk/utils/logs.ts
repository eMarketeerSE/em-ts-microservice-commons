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
      // Stage is a compile-time union. A runtime value outside it means a
      // caller widened the type — fail loud rather than silently returning a
      // dev-shaped default for what may be a production deployment.
      throw new Error(`getLogRetentionDays: unknown stage "${stage as string}"`)
  }
}

/**
 * Convert retention days number to RetentionDays enum.
 *
 * Validates `days` against `RetentionDays`'s TS enum reverse-mapping (every
 * numeric enum member exposes its name as a string-keyed property — e.g.
 * `RetentionDays[1] === 'ONE_DAY'`). This catches typos without
 * hand-maintaining a switch in parallel with the SDK enum.
 *
 * `0` is rejected even though `RetentionDays.INFINITE === 0`: passing 0 from
 * a config object almost always means "unset" rather than "retain forever".
 * Callers that genuinely want INFINITE must pass `RetentionDays.INFINITE`
 * explicitly via a non-numeric path (or update this guard with a clear test).
 */
export const convertRetentionDays = (days?: number): RetentionDays | undefined => {
  if (days === undefined || days === null) return undefined

  if (days === 0) {
    throw new Error(
      'logRetentionDays: 0 is not accepted (would map to RetentionDays.INFINITE). '
      + 'Pass RetentionDays.INFINITE explicitly if infinite retention is intended.'
    )
  }

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
  switch (stage) {
    case 'prod':
      return RemovalPolicy.RETAIN
    case 'staging':
    case 'test':
    case 'dev':
      return RemovalPolicy.DESTROY
    default:
      // Same rationale as getLogRetentionDays: a typo like 'production' must
      // not silently produce DESTROY for what should be a retained resource.
      throw new Error(`getRemovalPolicy: unknown stage "${stage as string}"`)
  }
}
