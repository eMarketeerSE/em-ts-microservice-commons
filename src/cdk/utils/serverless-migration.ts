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
  const cfnFunction = fn.node.defaultChild

  if (!(cfnFunction instanceof CfnFunction)) {
    throw new Error(
      `Cannot override Lambda logical ID for "${serverlessFunctionName}": ` +
        'the function does not have a CfnFunction default child. ' +
        'Imported functions (e.g. via Function.fromFunctionArn) cannot have their logical IDs overridden.'
    )
  }

  cfnFunction.overrideLogicalId(`${prefix}LambdaFunction`)
}

/**
 * Override the logical ID of a log group to match Serverless Framework naming: {prefix}LogGroup.
 * Sets removal policy to RETAIN to prevent CloudFormation from deleting existing log data.
 */
const overrideLogGroupLogicalId = (logGroup: Construct, serverlessFunctionName: string): void => {
  const prefix = toServerlessLogicalIdPrefix(serverlessFunctionName)
  const defaultChild = logGroup.node.defaultChild

  if (!(defaultChild instanceof CfnLogGroup)) {
    throw new Error(
      `Cannot override log group logical ID for "${serverlessFunctionName}": ` +
        'the log group does not have a CfnLogGroup default child. ' +
        'Imported log groups (e.g. via importExistingLogGroup) cannot have their logical IDs overridden.'
    )
  }

  defaultChild.overrideLogicalId(`${prefix}LogGroup`)
  defaultChild.applyRemovalPolicy(RemovalPolicy.RETAIN)
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
 * Only works with functions that have explicit (non-imported) log groups.
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
 * Only works with layers created in this stack, not imported layers.
 *
 * @param logicalId - The full logical ID to set (e.g. 'ChromiumLayerLambdaLayer')
 */
export const overrideLayerLogicalId = (layer: ILayerVersion, logicalId: string): void => {
  const defaultChild = (layer as Construct).node.defaultChild

  if (!(defaultChild instanceof CfnLayerVersion)) {
    throw new Error(
      `Cannot override logical ID "${logicalId}": the layer does not have a CfnLayerVersion default child. ` +
        'Imported layers (e.g. via LayerVersion.fromLayerVersionArn) cannot have their logical IDs overridden.'
    )
  }

  defaultChild.overrideLogicalId(logicalId)
}

/**
 * Override an IAM role's logical ID.
 * Defaults to 'IamRoleLambdaExecution' — the standard Serverless Framework
 * shared execution role logical ID.
 *
 * Only works with roles created in this stack, not imported roles.
 */
export const overrideRoleLogicalId = (
  role: Construct,
  logicalId = 'IamRoleLambdaExecution'
): void => {
  const defaultChild = role.node.defaultChild

  if (!(defaultChild instanceof CfnRole)) {
    throw new Error(
      'Cannot override role logical ID: the role does not have a CfnRole default child. ' +
        'Imported roles (e.g. via Role.fromRoleArn) cannot have their logical IDs overridden.'
    )
  }

  defaultChild.overrideLogicalId(logicalId)
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
