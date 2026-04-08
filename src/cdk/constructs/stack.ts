import * as cdk from 'aws-cdk-lib'
import { Role, ServicePrincipal, ManagedPolicy, IManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { LambdaConfig, Stage } from '../types'
import { generateStackName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { EmLambdaFunction } from './lambda'
import {
  overrideFunctionLogicalIds,
  overrideRoleLogicalId,
  createServerlessCompatibleOutput
} from '../utils/serverless-migration'

export interface EmStackProps extends cdk.StackProps {
  readonly stage: Stage
  readonly serviceName: string
  readonly tags?: Record<string, string>
  readonly owner?: string
  readonly costCenter?: string
  /**
   * When true, creates a shared IAM role for all functions — matching the
   * Serverless Framework pattern where one role is shared across all Lambdas.
   *
   * The role is pinned to logical ID `IamRoleLambdaExecution` so existing
   * Serverless stacks are migrated in-place without resource replacement.
   *
   * `createFunction()` will use this role by default unless a specific role
   * is passed in the function config.
   */
  readonly useSharedRole?: boolean
  /**
   * Managed policies to attach to the shared role.
   * Only used when `useSharedRole` is true.
   * Defaults to CloudWatchLambdaInsightsExecutionRolePolicy.
   */
  readonly sharedRoleManagedPolicies?: IManagedPolicy[]
}

/**
 * Config for `EmStack.createFunction()`. Stage and serviceName are optional —
 * they default to the stack's values.
 */
export type CreateFunctionConfig = Omit<LambdaConfig, 'stage' | 'serviceName'> & {
  stage?: LambdaConfig['stage']
  serviceName?: LambdaConfig['serviceName']
}

/**
 * Base stack class for eMarketeer microservices.
 *
 * - Auto-generates stackName from stage + serviceName
 * - Auto-generates description
 * - Applies standard tags (Stage, Service, ManagedBy) to all resources
 * - `createFunction()` creates Lambdas with stable, Serverless-compatible logical IDs
 * - `addOutput()` creates exports with the `sls-{service}-{stage}-{key}` pattern
 * - `overrideLayer()` pins layer logical IDs
 * - Optional shared role for Serverless migration compatibility
 *
 * @example
 * ```typescript
 * export class MyServiceStack extends EmStack {
 *   constructor(scope: Construct, id: string, props: MyStackProps) {
 *     super(scope, id, { ...props, useSharedRole: true })
 *
 *     const fn = this.createFunction('GetData', {
 *       functionName: 'get-data',
 *       handler: 'index.handler',
 *       codePath: './dist/handlers/get-data'
 *     })
 *
 *     this.addOutput('ServiceEndpoint', 'https://...')
 *   }
 * }
 * ```
 */
export class EmStack extends cdk.Stack {
  public readonly stage: Stage
  public readonly serviceName: string
  /**
   * Shared IAM role for all functions. Only created when `useSharedRole: true`.
   * Pinned to logical ID `IamRoleLambdaExecution` for Serverless migration.
   */
  public readonly sharedRole?: Role

  constructor(scope: Construct, id: string, props: EmStackProps) {
    super(scope, id, {
      ...props,
      stackName:
        props.stackName ??
        generateStackName({
          stage: props.stage,
          serviceName: props.serviceName
        }),
      description: props.description ?? `${props.serviceName} (${props.stage})`
    })

    this.stage = props.stage
    this.serviceName = props.serviceName

    applyStandardTags(this, {
      stage: props.stage,
      serviceName: props.serviceName,
      owner: props.owner,
      costCenter: props.costCenter,
      customTags: props.tags
    })

    if (props.useSharedRole) {
      this.sharedRole = new Role(this, 'LambdaExecutionRole', {
        roleName: `${props.serviceName}-${props.stage}-${this.region}-lambdaRole`,
        path: '/',
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: props.sharedRoleManagedPolicies ?? [
          ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
          ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy')
        ]
      })
      overrideRoleLogicalId(this.sharedRole)
    }
  }

  /**
   * Create a Lambda function. Defaults `stage` and `serviceName` from the stack.
   *
   * When `useSharedRole: true` (Serverless migration mode), also:
   * - Overrides Lambda logical ID to `{prefix}LambdaFunction`
   * - Overrides log group logical ID to `{prefix}LogGroup`
   * - Sets log group removal policy to RETAIN
   * - Uses the shared role unless `config.role` is provided
   *
   * This means existing Serverless stacks are migrated in-place — no manual
   * logical ID overrides needed.
   */
  createFunction(id: string, config: CreateFunctionConfig): EmLambdaFunction {
    const fn = new EmLambdaFunction(this, id, {
      ...config,
      stage: config.stage ?? this.stage,
      serviceName: config.serviceName ?? this.serviceName,
      role: config.role ?? this.sharedRole
    })

    if (this.sharedRole) {
      if (config.importExistingLogGroup) {
        throw new Error(
          `Cannot use importExistingLogGroup with useSharedRole (migration mode) for "${config.functionName}". ` +
            'Migration mode requires explicit log groups to override their logical IDs.'
        )
      }
      overrideFunctionLogicalIds(fn.function, config.functionName)
    }

    return fn
  }

  /**
   * Create a CfnOutput with a stable export name.
   * Export pattern: `sls-{serviceName}-{stage}-{outputKey}`
   *
   * @param id - Construct ID for the output
   * @param value - The output value
   * @param options - Optional outputKey (defaults to `id`) and description
   */
  addOutput(
    id: string,
    value: string,
    options?: { outputKey?: string; description?: string }
  ): cdk.CfnOutput {
    return createServerlessCompatibleOutput(this, id, {
      serviceName: this.serviceName,
      stage: this.stage,
      outputKey: options?.outputKey ?? id,
      value,
      description: options?.description
    })
  }
}
