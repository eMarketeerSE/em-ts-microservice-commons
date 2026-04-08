import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import {
  Function as LambdaFunction,
  CfnFunction,
  ILayerVersion,
  CfnLayerVersion
} from 'aws-cdk-lib/aws-lambda'
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnRole } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

/**
 * Convert a Serverless Framework function name to its CloudFormation logical ID prefix.
 *
 * Matches the Serverless Framework's normalisation algorithm:
 *   1. Replace hyphens with "Dash", underscores with "Underscore"
 *   2. Capitalize the first character
 *
 * Example: 'capture-screenshot-from-url' -> 'CaptureDashscreenshotDashfromDashurl'
 */
export const toServerlessLogicalIdPrefix = (functionName: string): string => {
  const normalized = functionName.replace(/-/g, 'Dash').replace(/_/g, 'Underscore')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/**
 * Override the logical ID of a Lambda function's CfnFunction to match
 * Serverless Framework naming: {prefix}LambdaFunction
 */
const overrideLambdaLogicalId = (fn: LambdaFunction, serverlessFunctionName: string): void => {
  const prefix = toServerlessLogicalIdPrefix(serverlessFunctionName)
  const cfnFunction = fn.node.defaultChild as CfnFunction
  cfnFunction.overrideLogicalId(`${prefix}LambdaFunction`)
}

/**
 * Override the logical ID of a log group to match Serverless Framework naming: {prefix}LogGroup.
 * Sets removal policy to RETAIN to prevent CloudFormation from deleting existing log data.
 */
const overrideLogGroupLogicalId = (logGroup: Construct, serverlessFunctionName: string): void => {
  const prefix = toServerlessLogicalIdPrefix(serverlessFunctionName)
  const cfnLogGroup = logGroup.node.defaultChild as CfnLogGroup
  cfnLogGroup.overrideLogicalId(`${prefix}LogGroup`)
  cfnLogGroup.applyRemovalPolicy(RemovalPolicy.RETAIN)
}

/**
 * Override both the Lambda function and its associated log group logical IDs.
 * This is the primary convenience function for Serverless-to-CDK migration — one
 * call per migrated function.
 *
 * - Sets the function logical ID to {prefix}LambdaFunction
 * - Sets the log group logical ID to {prefix}LogGroup
 * - Sets the log group removal policy to RETAIN (prevents log deletion during migration)
 *
 * @example
 * ```typescript
 * import { overrideFunctionLogicalIds } from '@emarketeer/ts-microservice-commons/cdk'
 *
 * const fn = new EmLambdaFunction(this, 'MyFunction', { ... })
 * overrideFunctionLogicalIds(fn.function, 'my-function')
 * ```
 */
export const overrideFunctionLogicalIds = (
  fn: LambdaFunction,
  serverlessFunctionName: string
): void => {
  overrideLambdaLogicalId(fn, serverlessFunctionName)
  overrideLogGroupLogicalId(fn.logGroup as Construct, serverlessFunctionName)
}

/**
 * Override a Lambda layer's logical ID.
 *
 * Serverless Framework uses the layer key from serverless.yml as the logical ID,
 * typically in the form '{LayerName}LambdaLayer'.
 *
 * @param logicalId - The full logical ID to set (e.g. 'ChromiumLayerLambdaLayer')
 */
export const overrideLayerLogicalId = (layer: ILayerVersion, logicalId: string): void => {
  const cfnLayer = (layer as Construct).node.defaultChild as CfnLayerVersion
  cfnLayer.overrideLogicalId(logicalId)
}

/**
 * Override an IAM role's logical ID.
 * Defaults to 'IamRoleLambdaExecution' — the standard Serverless Framework
 * shared execution role logical ID.
 */
export const overrideRoleLogicalId = (
  role: Construct,
  logicalId = 'IamRoleLambdaExecution'
): void => {
  const cfnRole = role.node.defaultChild as CfnRole
  cfnRole.overrideLogicalId(logicalId)
}

export interface ServerlessCompatibleOutputProps {
  readonly serviceName: string
  readonly stage: string
  readonly outputKey: string
  readonly value: string
  readonly description?: string
}

/**
 * Create a CfnOutput with a Serverless Framework-compatible export name.
 * Export pattern: sls-{serviceName}-{stage}-{outputKey}
 */
export const createServerlessCompatibleOutput = (
  scope: Construct,
  id: string,
  props: ServerlessCompatibleOutputProps
): CfnOutput => {
  return new CfnOutput(scope, id, {
    value: props.value,
    description: props.description,
    exportName: `sls-${props.serviceName}-${props.stage}-${props.outputKey}`
  })
}
