import * as cdk from 'aws-cdk-lib'
import { Annotations, Aws, Tags } from 'aws-cdk-lib'
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
  ManagedPolicy,
  IManagedPolicy
} from 'aws-cdk-lib/aws-iam'
import { ITopic, Topic } from 'aws-cdk-lib/aws-sns'
import { SqsSubscriptionProps } from 'aws-cdk-lib/aws-sns-subscriptions'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { LambdaConfig, Stage } from '../types'
import { generateStackName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { resolveHandlerPath } from '../utils/handler-path'
import { EmLambdaFunction } from './lambda'
import { EmEventBridgeRule } from './eventbridge'
import { LambdaWithQueue, LambdaWithQueueProps } from './lambda-with-queue'
import { TopicQueueConsumer } from './topic-queue-consumer'
import {
  overrideFunctionLogicalIds,
  overrideRoleLogicalId,
  createServerlessCompatibleOutput
} from '../utils/serverless-migration'
import { createXRayTracingPolicy } from '../utils/iam'

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
   * Replaces the default managed policies on the shared role.
   * Only used when `useSharedRole` is true.
   *
   * Defaults to `[AWSLambdaBasicExecutionRole, CloudWatchLambdaInsightsExecutionRolePolicy]`.
   * Providing this option replaces that entire list — include `AWSLambdaBasicExecutionRole`
   * explicitly if it is still needed.
   *
   * For VPC services, prefer passing `sharedRole` to `createRdsVpcConfig` instead.
   * That appends `AWSLambdaVPCAccessExecutionRole` without replacing the defaults.
   */
  readonly sharedRoleManagedPolicies?: IManagedPolicy[]
  /**
   * Default config applied to every function created via `createFunction()`.
   * Per-function config takes precedence over these defaults.
   *
   * @example
   * ```typescript
   * super(scope, id, {
   *   ...props,
   *   defaultFunctionConfig: {
   *     memorySize: 1536,
   *     timeout: Duration.seconds(30),
   *     enableTracing: true,
   *     layers: [insightsLayer],
   *   }
   * })
   * ```
   */
  readonly defaultFunctionConfig?: Partial<CreateFunctionConfig>
}

/**
 * Config for `EmStack.createFunction()`. Stage and serviceName are optional —
 * they default to the stack's values.
 *
 * When `handlerPath` is provided, `codePath`, `handler`, and `functionName`
 * become optional — they are derived from the source path:
 *
 * ```typescript
 * // Instead of:
 * this.createFunction('CaptureScreenshot', {
 *   functionName: 'capture-screenshot-from-url',
 *   handler: 'index.handler',
 *   codePath: 'dist/handlers/capture-screenshot/capture-screenshot-from-url',
 * })
 *
 * // You can write:
 * this.createFunction('CaptureScreenshot', {
 *   handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url',
 * })
 * ```
 */
export type CreateFunctionConfig = Omit<
  LambdaConfig,
  'stage' | 'serviceName' | 'handler' | 'codePath' | 'functionName'
> & {
  stage?: LambdaConfig['stage']
  serviceName?: LambdaConfig['serviceName']
  handler?: LambdaConfig['handler']
  codePath?: LambdaConfig['codePath']
  functionName?: LambdaConfig['functionName']
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
 *     // Short form — derives codePath, handler, and functionName from handlerPath
 *     const fn = this.createFunction('GetData', {
 *       handlerPath: 'src/handlers/get-data',
 *     })
 *
 *     // Explicit form — still supported
 *     const fn2 = this.createFunction('PostData', {
 *       functionName: 'post-data',
 *       handler: 'index.handler',
 *       codePath: './dist/handlers/post-data',
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
  private defaultFunctionConfig: Partial<CreateFunctionConfig>

  constructor(scope: Construct, id: string, props: EmStackProps) {
    super(scope, id, {
      ...props,
      stackName:
        props.stackName ??
        (props.useSharedRole
          ? `${props.serviceName}-${props.stage}`
          : generateStackName({
              stage: props.stage,
              serviceName: props.serviceName
            })),
      description: props.description ?? `${props.serviceName} (${props.stage})`
    })

    this.stage = props.stage
    this.serviceName = props.serviceName
    this.defaultFunctionConfig = props.defaultFunctionConfig ?? {}

    applyStandardTags(this, {
      stage: props.stage,
      serviceName: props.serviceName,
      owner: props.owner,
      costCenter: props.costCenter,
      customTags: props.tags
    })

    Tags.of(this).add('em-microservice', `${props.stage}-${props.serviceName}`)

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
   * Update default function config after construction.
   * Use this when defaults depend on resources created after `super()`.
   * Environment is deep-merged with any existing defaults.
   *
   * @example
   * ```typescript
   * // After creating resources:
   * this.setDefaultFunctionConfig({
   *   environment: sharedEnvironment,
   *   vpcConfig,
   * })
   * ```
   */
  setDefaultFunctionConfig(config: Partial<CreateFunctionConfig>): void {
    this.defaultFunctionConfig = {
      ...this.defaultFunctionConfig,
      ...config,
      environment: {
        ...(this.defaultFunctionConfig.environment ?? {}),
        ...(config.environment ?? {})
      }
    }
  }

  private mergeConfig<T extends { environment?: Record<string, string> }>(config: T): T {
    const defaultEnv = this.defaultFunctionConfig.environment
    const configEnv = config.environment
    return {
      ...this.defaultFunctionConfig,
      ...config,
      ...(defaultEnv || configEnv
        ? { environment: { ...(defaultEnv ?? {}), ...(configEnv ?? {}) } }
        : {})
    } as T
  }

  /**
   * Create a Lambda function. Defaults `stage` and `serviceName` from the stack.
   *
   * When `useSharedRole: true` (Serverless migration mode), also:
   * - Overrides Lambda logical ID to `{prefix}LambdaFunction`
   * - Overrides log group logical ID to `{prefix}LogGroup`
   * - Sets log group removal policy to RETAIN
   * - Uses the shared role unless `config.role` is provided
   */
  createFunction(id: string, config: CreateFunctionConfig): EmLambdaFunction {
    const merged = this.mergeConfig(config)
    const resolved = resolveHandlerPath(merged)
    const functionName = resolved.functionName
    const handler = resolved.handler ?? merged.handler
    const codePath = resolved.codePath ?? merged.codePath

    if (!handler || !codePath) {
      throw new Error(
        `createFunction() requires either \`handlerPath\` or all of \`functionName\`, \`handler\`, and \`codePath\` for "${functionName}".`
      )
    }

    const fn = new EmLambdaFunction(this, id, {
      ...merged,
      functionName,
      handler,
      codePath,
      stage: merged.stage ?? this.stage,
      serviceName: merged.serviceName ?? this.serviceName,
      role: merged.role ?? this.sharedRole
    })

    if (this.sharedRole) {
      if (merged.importExistingLogGroup) {
        throw new Error(
          `Cannot use importExistingLogGroup with useSharedRole (migration mode) for "${functionName}". ` +
            'Migration mode requires explicit log groups to override their logical IDs.'
        )
      }
      overrideFunctionLogicalIds(fn.function, functionName)
    }

    return fn
  }

  /**
   * Create a Lambda function with an SQS queue consumer pattern.
   * Defaults `stage`, `serviceName`, and `role` from the stack.
   *
   * When `useSharedRole: true` (Serverless migration mode), also:
   * - Uses the shared role (skips per-function role creation)
   * - Overrides Lambda + log group logical IDs to match Serverless Framework naming
   *
   * @example
   * ```typescript
   * const consumer = this.createQueueConsumer('ProcessJobs', {
   *   handlerPath: 'src/handlers/process-jobs',
   *   queueName: 'dev-my-service-queue-jobs',
   *   memorySize: 512,
   *   timeout: Duration.seconds(30),
   *   enableTracing: true,
   *   alarmTopic: this.alarmTopic,
   * })
   * ```
   */
  createQueueConsumer(id: string, config: CreateQueueConsumerConfig): LambdaWithQueue {
    const merged = this.mergeConfig(config)
    const { functionName } = resolveHandlerPath(merged)

    return new LambdaWithQueue(this, id, {
      ...merged,
      stage: merged.stage ?? this.stage,
      serviceName: merged.serviceName ?? this.serviceName,
      role: merged.role ?? this.sharedRole,
      ...(this.sharedRole && {
        serverlessFunctionName: merged.serverlessFunctionName ?? functionName
      })
    })
  }

  /**
   * Create a Lambda function consuming messages from an SNS topic via SQS.
   * Combines `createQueueConsumer()` + `subscribeToTopic()` in one call and
   * inherits the stack's default function config (env vars, VPC, timeout).
   *
   * Prefer this over constructing `TopicQueueConsumer` directly — the raw
   * constructor bypasses default-config merging.
   *
   * @example
   * ```typescript
   * this.createTopicQueueConsumer('ProcessInvoices', {
   *   topic: invoiceTopic,
   *   subscriptionOptions: { rawMessageDelivery: true },
   *   handlerPath: 'src/handlers/process-invoices',
   *   queueName: 'dev-my-service-invoice-queue',
   *   alarmTopic,
   * })
   * ```
   */
  createTopicQueueConsumer(
    id: string,
    config: CreateTopicQueueConsumerConfig
  ): TopicQueueConsumer {
    const { topic, subscriptionOptions, ...queueConfig } = config
    const merged = this.mergeConfig(queueConfig)
    const { functionName } = resolveHandlerPath(merged)

    return new TopicQueueConsumer(this, id, {
      ...merged,
      stage: merged.stage ?? this.stage,
      serviceName: merged.serviceName ?? this.serviceName,
      role: merged.role ?? this.sharedRole,
      topic,
      subscriptionOptions,
      ...(this.sharedRole && {
        serverlessFunctionName: merged.serverlessFunctionName ?? functionName
      })
    })
  }

  /**
   * Create a scheduled Lambda function with an EventBridge rule.
   * Combines `createFunction()` + `EmEventBridgeRule` + `addLambdaTarget()` in one call.
   *
   * @example
   * ```typescript
   * this.createScheduledFunction('DailyReport', {
   *   handlerPath: 'src/handlers/daily-report',
   *   schedule: 'cron(0 8 * * ? *)',
   * })
   * ```
   */
  createScheduledFunction(
    id: string,
    config: CreateScheduledFunctionConfig
  ): { function: EmLambdaFunction; rule: EmEventBridgeRule } {
    const { schedule, ruleName, ruleDescription, ...functionConfig } = config
    const fn = this.createFunction(id, functionConfig)

    const rule = new EmEventBridgeRule(this, `${id}Rule`, {
      stage: config.stage ?? this.stage,
      serviceName: config.serviceName ?? this.serviceName,
      ruleName: ruleName ?? resolveHandlerPath(functionConfig).functionName,
      description: ruleDescription,
      schedule
    })

    rule.addLambdaTarget(fn.function)

    return { function: fn, rule }
  }

  /**
   * Import an SSM parameter value.
   *
   * By default resolves `/{stage}/{serviceName}/{paramName}`.
   * Pass `{ raw: true }` to use the name as-is (for root-level params from Serverless).
   *
   * @example
   * ```typescript
   * // Convention-based:
   * this.ssmParam('db_host') // → /{stage}/{serviceName}/db_host
   *
   * // Raw (root-level SSM params):
   * this.ssmParam('proxy_dbms_host', { raw: true }) // → proxy_dbms_host
   * ```
   */
  ssmParam(paramName: string, options?: { serviceName?: string; raw?: boolean }): string {
    const path = options?.raw
      ? paramName
      : `/${this.stage}/${options?.serviceName ?? this.serviceName}/${paramName}`
    return StringParameter.valueForStringParameter(this, path)
  }

  /**
   * Import the alarm email topic by convention.
   * ARN: `arn:{partition}:sns:{region}:{account}:{stage}-alarm-email`
   */
  alarmTopic(): ITopic {
    const arn = `arn:${Aws.PARTITION}:sns:${Aws.REGION}:${Aws.ACCOUNT_ID}:${this.stage}-alarm-email`
    return Topic.fromTopicArn(this, 'AlarmTopic', arn)
  }

  /**
   * Add a Lambda invoke policy to the shared role.
   * @param functionPattern - Optional function name pattern. Defaults to `{stage}-{serviceName}-*`.
   *   Pass `'*'` for account-wide access.
   *
   * **Note:** The default pattern only matches functions named with the CDK convention
   * (`{stage}-{serviceName}-{fn}`). Functions created with `physicalName` using the legacy
   * Serverless convention (`{service}-{stage}-{fn}`) will not be matched. Pass `'*'` when
   * the service has any `physicalName` functions that must be invocable.
   */
  addLambdaInvokePolicy(functionPattern?: string): void {
    const role = this.requireSharedRole('addLambdaInvokePolicy')
    const pattern = functionPattern ?? `${this.stage}-${this.serviceName}-*`
    const resources =
      pattern === '*'
        ? ['*']
        : [`arn:${Aws.PARTITION}:lambda:${Aws.REGION}:${Aws.ACCOUNT_ID}:function:${pattern}`]
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources
      })
    )
  }

  /**
   * Add a Kinesis PutRecord/PutRecords policy to the shared role.
   * @param streamName - Short stream name (prefixed with `{stage}-`).
   */
  addKinesisPolicy(streamName: string): void {
    const role = this.requireSharedRole('addKinesisPolicy')
    const arn = `arn:${Aws.PARTITION}:kinesis:${Aws.REGION}:${Aws.ACCOUNT_ID}:stream/${this.stage}-${streamName}`
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kinesis:PutRecord', 'kinesis:PutRecords'],
        resources: [arn]
      })
    )
  }

  /**
   * Add an SNS Publish policy to the shared role.
   * @param topicOrName - An ITopic reference, or a short topic name (prefixed with `{stage}-`).
   */
  addSnsPublishPolicy(topicOrName: ITopic | string): void {
    const role = this.requireSharedRole('addSnsPublishPolicy')
    const arn =
      typeof topicOrName === 'string'
        ? `arn:${Aws.PARTITION}:sns:${Aws.REGION}:${Aws.ACCOUNT_ID}:${this.stage}-${topicOrName}`
        : topicOrName.topicArn
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [arn]
      })
    )
  }

  /**
   * Add an SQS SendMessage policy to the shared role.
   * @param queueName - Short queue name (prefixed with `{stage}-`).
   */
  addSqsSendPolicy(queueName: string): void {
    const role = this.requireSharedRole('addSqsSendPolicy')
    const arn = `arn:${Aws.PARTITION}:sqs:${Aws.REGION}:${Aws.ACCOUNT_ID}:${this.stage}-${queueName}`
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
        resources: [arn]
      })
    )
  }

  /** Add an XRay tracing policy to the shared role. */
  addXRayPolicy(): void {
    const role = this.requireSharedRole('addXRayPolicy')
    role.addToPolicy(createXRayTracingPolicy())
  }

  /**
   * Add a CloudWatch Logs policy to the shared role.
   * Grants describe, read, and query access on all log groups.
   * Basic write access (CreateLogGroup, CreateLogStream, PutLogEvents) is already
   * covered by AWSLambdaBasicExecutionRole attached to the shared role.
   */
  addCloudWatchLogsPolicy(): void {
    const role = this.requireSharedRole('addCloudWatchLogsPolicy')
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:FilterLogEvents',
          'logs:GetLogEvents',
          'logs:StartQuery',
          'logs:StopQuery',
          'logs:GetQueryResults'
        ],
        resources: ['*']
      })
    )
  }

  /**
   * Add an SNS policy to the shared role.
   * @param options.actions - SNS actions (e.g. ['sns:Publish', 'sns:Subscribe']).
   * @param options.resources - Resource ARNs. When omitted, defaults to `['*']`
   *   (account-wide access). Prefer `addSnsPublishPolicy(topicArn)` for scoped
   *   publish-only access to a specific topic.
   */
  addSnsPolicy(options: { actions: string[]; resources?: string[] }): void {
    const role = this.requireSharedRole('addSnsPolicy')
    if (!options.resources) {
      Annotations.of(this).addWarning(
        'addSnsPolicy: no resources specified — policy grants account-wide SNS access on all topics. ' +
          'Pass resources to scope the policy, or use addSnsPublishPolicy(topicArn) for publish access.'
      )
    }
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: options.actions,
        resources: options.resources ?? ['*']
      })
    )
  }

  /**
   * Add an SQS consumer policy to the shared role.
   * Grants ChangeMessageVisibility, DeleteMessage, ReceiveMessage, SendMessage,
   * and GetQueueAttributes on each queue.
   * @param queueNames - Short queue names without stage prefix. Stage prefix added automatically.
   */
  addSqsConsumerPolicy(queueNames: string[]): void {
    const role = this.requireSharedRole('addSqsConsumerPolicy')
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'sqs:ChangeMessageVisibility',
          'sqs:DeleteMessage',
          'sqs:ReceiveMessage',
          'sqs:SendMessage',
          'sqs:GetQueueAttributes'
        ],
        resources: queueNames.map(
          name => `arn:${Aws.PARTITION}:sqs:${Aws.REGION}:${Aws.ACCOUNT_ID}:${this.stage}-${name}`
        )
      })
    )
  }

  /**
   * Add an execute-api:Invoke policy to the shared role.
   * Resources are scoped to `*` — API Gateway requires the full execution ARN
   * (`arn:{partition}:execute-api:{region}:{account}:{api-id}/{stage}/{method}/{path}`)
   * which is not available as a stable value in migration stacks.
   */
  addExecuteApiPolicy(): void {
    const role = this.requireSharedRole('addExecuteApiPolicy')
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: ['*']
      })
    )
  }

  /**
   * Add an S3 policy to the shared role.
   * @param bucketName - Full bucket name (no stage prefix added).
   * @param actions - S3 actions to grant. Defaults to `['s3:GetObject', 's3:PutObject',
   *   's3:DeleteObject', 's3:ListBucket']`. Pass an explicit list for narrower or broader access.
   */
  addS3Policy(bucketName: string, actions?: string[]): void {
    const role = this.requireSharedRole('addS3Policy')
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: actions ?? ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        resources: [
          `arn:${Aws.PARTITION}:s3:::${bucketName}`,
          `arn:${Aws.PARTITION}:s3:::${bucketName}/*`
        ]
      })
    )
  }

  /**
   * Add a DynamoDB policy to the shared role.
   * Grants read, write, transact, and describe actions on each table.
   * Uses literal * for region and account in ARNs.
   * @param tableNames - Short table names without stage prefix. Stage prefix added automatically.
   * @param options.streamTableNames - Short table names to also grant stream read access (/stream/*).
   * @param options.indexTableNames - Short table names to also grant Query/Scan on all indexes (/index/*).
   *   Uses a separate policy statement scoped to only dynamodb:Query and dynamodb:Scan.
   */
  addDynamoDbPolicy(tableNames: string[], options?: { streamTableNames?: string[], indexTableNames?: string[] }): void {
    const role = this.requireSharedRole('addDynamoDbPolicy')
    const tableArns = tableNames.map(
      n => `arn:${Aws.PARTITION}:dynamodb:*:*:table/${this.stage}-${n}`
    )
    const streamArns = (options?.streamTableNames ?? []).map(
      n => `arn:${Aws.PARTITION}:dynamodb:*:*:table/${this.stage}-${n}/stream/*`
    )
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:TransactGetItems',
          'dynamodb:TransactWriteItems',
          'dynamodb:DescribeTable',
          'dynamodb:DescribeStream',
          'dynamodb:GetRecords',
          'dynamodb:GetShardIterator',
          'dynamodb:ListStreams'
        ],
        resources: [...tableArns, ...streamArns]
      })
    )
    const indexArns = (options?.indexTableNames ?? []).map(
      n => `arn:${Aws.PARTITION}:dynamodb:*:*:table/${this.stage}-${n}/index/*`
    )
    if (indexArns.length > 0) {
      role.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['dynamodb:Query', 'dynamodb:Scan'],
          resources: indexArns,
        })
      )
    }
  }

  private requireSharedRole(methodName: string): Role {
    if (!this.sharedRole) {
      throw new Error(`${methodName}() requires useSharedRole: true on the stack.`)
    }
    return this.sharedRole
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

/**
 * Config for `EmStack.createQueueConsumer()`. Stage, serviceName, and role
 * are optional — they default to the stack's values.
 */
export type CreateQueueConsumerConfig = Omit<LambdaWithQueueProps, 'stage' | 'serviceName'> & {
  stage?: LambdaWithQueueProps['stage']
  serviceName?: LambdaWithQueueProps['serviceName']
}

/**
 * Config for `EmStack.createScheduledFunction()`.
 */
export type CreateScheduledFunctionConfig = CreateFunctionConfig & {
  /** Schedule expression (e.g. `'cron(5 * * * ? *)'` or `'rate(1 day)'`). */
  readonly schedule: string
  /** Override the EventBridge rule name. Defaults to the function name. */
  readonly ruleName?: string
  /** Description for the EventBridge rule. */
  readonly ruleDescription?: string
}

/**
 * Config for `EmStack.createTopicQueueConsumer()`. Adds the SNS topic and
 * subscription options on top of `CreateQueueConsumerConfig`.
 */
export type CreateTopicQueueConsumerConfig = CreateQueueConsumerConfig & {
  /** The SNS topic to subscribe to. */
  readonly topic: ITopic
  /** Options for the SQS subscription (e.g. rawMessageDelivery, filterPolicy). */
  readonly subscriptionOptions?: Omit<SqsSubscriptionProps, 'rawMessageDelivery'> & {
    rawMessageDelivery?: boolean
  }
}
