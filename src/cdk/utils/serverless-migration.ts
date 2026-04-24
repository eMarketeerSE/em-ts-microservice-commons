import { CfnOutput, Duration, RemovalPolicy, Token } from 'aws-cdk-lib'
import {
  Function as LambdaFunction,
  CfnFunction,
  CfnPermission,
  ILayerVersion,
  CfnLayerVersion
} from 'aws-cdk-lib/aws-lambda'
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnRole } from 'aws-cdk-lib/aws-iam'
import { CfnSubscription, CfnSubscriptionProps, ITopic } from 'aws-cdk-lib/aws-sns'
import { Queue, CfnQueue, CfnQueuePolicy, CfnQueuePolicyProps } from 'aws-cdk-lib/aws-sqs'
import { Table, CfnTable, TableProps, BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import { DlqAlarm } from '../constructs/dlq-alarm'
import { Stage } from '../types'
import { getRemovalPolicy } from './logs'

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
  const logGroup = fn.logGroup
  if (!(logGroup instanceof Construct)) {
    throw new Error(
      `Cannot override log group logical ID for "${serverlessFunctionName}": ` +
        'fn.logGroup is not a Construct. ' +
        'Imported log groups (importExistingLogGroup: true) cannot have their logical IDs overridden.'
    )
  }
  overrideLogGroupLogicalId(logGroup, serverlessFunctionName)
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
  logicalId = 'IamRoleLambdaExecution',
  options?: {
    /** Override RoleName. Required when live Serverless stack used a specific role name. */
    readonly roleName?: string
    /**
     * Delete Path from the template. Serverless never emits Path; CDK always writes Path: "/".
     * A mismatch causes role replacement. Set true to prevent it.
     */
    readonly deletePath?: boolean
  }
): void => {
  const defaultChild = role.node.defaultChild

  if (!(defaultChild instanceof CfnRole)) {
    throw new Error(
      'Cannot override role logical ID: the role does not have a CfnRole default child. ' +
        'Imported roles (e.g. via Role.fromRoleArn) cannot have their logical IDs overridden.'
    )
  }

  defaultChild.overrideLogicalId(logicalId)

  if (options?.roleName) {
    defaultChild.addPropertyOverride('RoleName', options.roleName)
  }

  if (options?.deletePath) {
    defaultChild.addPropertyDeletionOverride('Path')
  }
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
): CfnOutput =>
  new CfnOutput(scope, id, {
    value: props.value,
    description: props.description,
    exportName: `sls-${props.serviceName}-${props.stage}-${props.outputKey}`
  })

export interface MakeServerlessQueueOpts {
  /** Override visibility timeout. Defaults to 900 seconds (Serverless convention). */
  readonly visibilityTimeout?: Duration
  /** Max times a message is received before moving to DLQ. Defaults to 3. */
  readonly maxReceiveCount?: number
  /**
   * When provided, creates a DlqAlarm on the DLQ.
   * Uses the DlqAlarm commons construct.
   */
  readonly alarm?: {
    readonly name: string
    readonly topic: ITopic
    /** CloudFormation logical ID override for the alarm. Use during Serverless-to-CDK migrations. */
    readonly logicalId?: string
  }
}

/**
 * Creates an SQS queue with a dead-letter queue using the names and logical IDs
 * from the existing Serverless stack.
 *
 * Use this during Serverless to CDK migrations when the queues already exist.
 * The queue and DLQ logical IDs must match the CloudFormation resources created
 * by Serverless, otherwise CloudFormation can replace the queues during deploy.
 *
 * Production queues are retained. Other stages use the shared removal policy
 * from `getRemovalPolicy()`. The DLQ message retention is set to 14 days.
 *
 * @example
 * ```typescript
 * const alarmTopic = (scope as EmStack).alarmTopic()
 * const { queue, dlq } = makeServerlessQueue(
 *   scope, 'MqlEventsQueue', 'MqlEventsQueueDLQ',
 *   `${svc}-mql-event-queue`, `${svc}-mql-event-queue-dlq`,
 *   stage,
 *   { alarm: { name: 'MqlEventsQueueDLQAlarm', topic: alarmTopic } },
 * )
 * ```
 */
export function makeServerlessQueue(
  scope: Construct,
  queueLogicalId: string,
  dlqLogicalId: string,
  queueName: string,
  dlqName: string,
  stage: Stage,
  opts: MakeServerlessQueueOpts = {}
): { queue: Queue; dlq: Queue } {
  const removalPolicy = getRemovalPolicy(stage)

  const dlq = new Queue(scope, dlqLogicalId, {
    queueName: dlqName,
    retentionPeriod: Duration.days(14),
    removalPolicy
  })
  const cfnDlq = dlq.node.defaultChild
  if (!(cfnDlq instanceof CfnQueue)) {
    throw new Error(
      `Cannot override DLQ logical ID "${dlqLogicalId}": defaultChild is not a CfnQueue.`
    )
  }
  cfnDlq.overrideLogicalId(dlqLogicalId)

  const queue = new Queue(scope, queueLogicalId, {
    queueName,
    visibilityTimeout: opts.visibilityTimeout ?? Duration.seconds(900),
    deadLetterQueue: { queue: dlq, maxReceiveCount: opts.maxReceiveCount ?? 3 },
    removalPolicy
  })
  const cfnQueue = queue.node.defaultChild
  if (!(cfnQueue instanceof CfnQueue)) {
    throw new Error(
      `Cannot override queue logical ID "${queueLogicalId}": defaultChild is not a CfnQueue.`
    )
  }
  cfnQueue.overrideLogicalId(queueLogicalId)

  if (opts.alarm) {
    new DlqAlarm(scope, `${queueLogicalId}DLQAlarm`, {
      dlq,
      alarmName: opts.alarm.name,
      alarmTopic: opts.alarm.topic,
      alarmLogicalId: opts.alarm.logicalId
    })
  }

  return { queue, dlq }
}

/**
 * Creates an SNS to SQS subscription with the same logical ID as the existing
 * Serverless resource.
 *
 * Use this when migrating an existing subscription from Serverless to CDK.
 * `topic.addSubscription(new SqsSubscription(queue))` lets CDK generate the
 * logical ID, which usually does not match the resource already in CloudFormation.
 * That can cause the subscription to be replaced during deployment.
 *
 * Both the construct ID and CloudFormation logical ID are set from `logicalId`.
 *
 * **Queue policy not included.** Unlike CDK's `SqsSubscription`, this helper only
 * creates the `AWS::SNS::Subscription`. It does NOT create an `AWS::SQS::QueuePolicy`
 * allowing SNS to send to the queue. On migrated stacks the policy was already created
 * by Serverless Framework — use `makeServerlessQueuePolicy` to preserve it with the
 * correct logical ID. On new queues call `makeServerlessQueuePolicy` (or use the CDK
 * `SqsSubscription` helper instead) to ensure SNS can deliver messages.
 *
 * @example
 * ```typescript
 * makeSnsToSqsSubscription(scope, 'TenantPurgeSubscription', {
 *   topicArn: `arn:aws:sns:${region}:${accountId}:${stage}-emarketeer-event-purge-tenant-data`,
 *   endpoint: queues.tenantPurgeQueue.queue.queueArn,
 *   protocol: 'sqs',
 *   rawMessageDelivery: true,
 * })
 * // Also preserve (or create) the matching queue policy:
 * makeServerlessQueuePolicy(scope, 'TenantPurgeSQSPolicy', { ... })
 * ```
 */
export function makeSnsToSqsSubscription(
  scope: Construct,
  logicalId: string,
  props: Omit<CfnSubscriptionProps, 'protocol'> & { readonly protocol: 'sqs' }
): CfnSubscription {
  const sub = new CfnSubscription(scope, logicalId, props)
  sub.overrideLogicalId(logicalId)
  return sub
}

/**
 * Creates an SNS to Lambda subscription and matching invoke permission using
 * logical IDs from the existing Serverless stack.
 *
 * Use this when migrating an existing SNS Lambda trigger to CDK. The normal CDK
 * subscription helper generates its own logical IDs, so it can replace the
 * Serverless-created subscription and permission during deploy. For SNS Lambda
 * subscriptions that means events published during the replacement window are lost.
 *
 * Pass literal ARN strings for both the topic and Lambda function. Avoid using
 * `topic.topicArn` or `function.functionArn` here, since changes in the generated
 * CloudFormation expression can still force replacement even when the final ARN is
 * the same.
 *
 * The Lambda function must have a fixed `physicalName`, otherwise the function ARN
 * cannot be written safely by hand.
 *
 * Check the live CloudFormation stack for the subscription and permission logical
 * IDs before using this helper:
 *
 * ```bash
 * aws cloudformation list-stack-resources --stack-name <stack-name> \
 *   --query "StackResourceSummaries[?ResourceType=='AWS::SNS::Subscription' ||
 *            ResourceType=='AWS::Lambda::Permission'].[LogicalResourceId,ResourceType]" \
 *   --output table
 * ```
 *
 * @example
 * ```typescript
 * const stagePrefix = stage.charAt(0).toUpperCase() + stage.slice(1)
 * makeSnsToLambdaSubscription(
 *   scope,
 *   `HandleDashemailDashstatusDashchangedSnsSubscription${stagePrefix}emarketeereventemailreputationchanged`,
 *   `HandleDashemailDashstatusDashchangedLambdaPermission${stagePrefix}emarketeereventemailreputationchangedSNS`,
 *   {
 *     topicArn:    `arn:aws:sns:eu-west-1:${accountId}:${stage}-emarketeer-event-email-reputation-changed`,
 *     functionArn: `arn:aws:lambda:eu-west-1:${accountId}:function:em-contacts-service-${stage}-handle-email-status-changed`,
 *   }
 * )
 * ```
 */
export function makeSnsToLambdaSubscription(
  scope: Construct,
  subscriptionLogicalId: string,
  permissionLogicalId: string,
  props: {
    readonly topicArn: string
    readonly functionArn: string
  }
): { subscription: CfnSubscription; permission: CfnPermission } {
  if (Token.isUnresolved(props.topicArn) || Token.isUnresolved(props.functionArn)) {
    throw new Error(
      'makeSnsToLambdaSubscription requires literal ARN strings, not CDK tokens. ' +
        'Using topic.topicArn or function.functionArn produces a CloudFormation expression whose ' +
        'rendered form can change independently of the resolved ARN, forcing subscription replacement. ' +
        'Pass the physical ARN as a string literal (e.g. `arn:aws:sns:eu-west-1:${accountId}:${stage}-my-topic`).'
    )
  }

  const subscription = new CfnSubscription(scope, subscriptionLogicalId, {
    topicArn: props.topicArn,
    protocol: 'lambda',
    endpoint: props.functionArn,
  })
  subscription.overrideLogicalId(subscriptionLogicalId)

  const permission = new CfnPermission(scope, permissionLogicalId, {
    action: 'lambda:InvokeFunction',
    functionName: props.functionArn,
    principal: 'sns.amazonaws.com',
    sourceArn: props.topicArn,
  })
  permission.overrideLogicalId(permissionLogicalId)

  return { subscription, permission }
}

/**
 * Creates an SQS queue policy using the logical ID from the existing Serverless
 * stack.
 *
 * Use this for migrated queues instead of `queue.addToResourcePolicy()`. The CDK
 * helper creates its own logical ID, which usually does not match the
 * `AWS::SQS::QueuePolicy` resource already managed by CloudFormation.
 *
 * Both the construct ID and CloudFormation logical ID are set from `logicalId`.
 *
 * @example
 * ```typescript
 * makeServerlessQueuePolicy(scope, 'MqlEventSQSPolicy', {
 *   queues: [queues.mqlEventsQueue.queue.queueUrl],
 *   policyDocument: {
 *     Version: '2012-10-17',
 *     Statement: [{
 *       Effect: 'Allow', Principal: '*', Action: 'sqs:SendMessage', Resource: '*',
 *       // Keep the policy limited to the SNS topic that sends to this queue.
 *       Condition: { ArnEquals: { 'aws:SourceArn': `arn:aws:sns:...` } },
 *     }],
 *   },
 * })
 * ```
 */
export function makeServerlessQueuePolicy(
  scope: Construct,
  logicalId: string,
  props: CfnQueuePolicyProps
): CfnQueuePolicy {
  const policy = new CfnQueuePolicy(scope, logicalId, props)
  policy.overrideLogicalId(logicalId)
  return policy
}

/**
 * Creates a DynamoDB table with the physical name and logical ID used by the
 * existing Serverless stack.
 *
 * Use this when moving an existing Serverless-managed table to CDK. The logical
 * ID should be copied from the CloudFormation resource, usually the resource key
 * from `serverless.yml`. If it does not match, CloudFormation may replace the
 * table during deploy.
 *
 * Defaults used by this helper:
 * - billing mode is PAY_PER_REQUEST
 * - point-in-time recovery is enabled only in prod
 * - removal policy is RETAIN in prod and DESTROY in other stages
 *
 * @example
 * ```typescript
 * const table = makeServerlessDynamoTable(scope, 'LeadCountTable', `${stage}-em-my-service-lead-count`, stage, {
 *   partitionKey: { name: 'streamId', type: AttributeType.STRING },
 *   sortKey: { name: 'day', type: AttributeType.NUMBER },
 * })
 * ```
 */
export function makeServerlessDynamoTable(
  scope: Construct,
  logicalId: string,
  tableName: string,
  stage: Stage,
  options: Omit<
    TableProps,
    | 'tableName'
    | 'billingMode'
    | 'pointInTimeRecovery'
    | 'pointInTimeRecoverySpecification'
    | 'removalPolicy'
  >
): Table {
  const table = new Table(scope, logicalId, {
    tableName,
    billingMode: BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: stage === 'prod' },
    removalPolicy: getRemovalPolicy(stage),
    ...options
  })
  const cfnTable = table.node.defaultChild
  if (!(cfnTable instanceof CfnTable)) {
    throw new Error(
      `Cannot override DynamoDB table logical ID "${logicalId}": defaultChild is not a CfnTable. ` +
        'Imported tables cannot have their logical IDs overridden.'
    )
  }
  cfnTable.overrideLogicalId(logicalId)
  return table
}
