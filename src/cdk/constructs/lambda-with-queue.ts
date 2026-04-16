import { Duration } from 'aws-cdk-lib'
import { CfnQueue, Queue, IQueue } from 'aws-cdk-lib/aws-sqs'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import {
  Function as LambdaFunction,
  Code,
  Architecture,
  Runtime,
  Tracing
} from 'aws-cdk-lib/aws-lambda'
import { IRole, Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnAlarm } from 'aws-cdk-lib/aws-cloudwatch'
import { ITopic } from 'aws-cdk-lib/aws-sns'
import { SqsSubscription, SqsSubscriptionProps } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'
import { Stage, VpcConfig } from '../types'
import { applyStandardTags } from '../utils/tagging'
import { getLogRetentionDays, getRemovalPolicy } from '../utils/logs'
import { buildRecapDevEnvironment, resolveRecapDevEndpoint } from '../utils/config'
import { DEFAULT_LAMBDA_RUNTIME } from '../utils/constants'
import { generateLambdaName } from '../utils/naming'
import { resolveHandlerPath } from '../utils/handler-path'
import { makeSnsToSqsSubscription, overrideFunctionLogicalIds } from '../utils/serverless-migration'
import { DlqAlarm } from './dlq-alarm'

export interface LambdaWithQueueProps {
  /** Lambda function name. Optional when `handlerPath` is provided. */
  readonly functionName?: string
  readonly queueName: string
  /** Short name used for codePath default and alarm naming. Defaults to functionName. */
  readonly resourceName?: string
  readonly handler?: string
  readonly codePath?: string
  /**
   * Source handler path, same as `EmStack.createFunction()`.
   * Derives `functionName`, `handler`, and `codePath` from the path.
   */
  readonly handlerPath?: string
  readonly reservedConcurrency?: number
  readonly batchSize?: number
  readonly reportBatchItemFailures?: boolean
  readonly stage: Stage
  readonly serviceName: string
  readonly environment?: Record<string, string>
  /** Lambda memory in MB. Defaults to 1024. */
  readonly memorySize?: number
  /** Lambda timeout. Defaults to 15 seconds. */
  readonly timeout?: Duration
  /** Enable X-Ray tracing. Defaults to true. */
  readonly enableTracing?: boolean
  readonly tags?: Record<string, string>
  /** IAM role name. Required when `role` is not provided. */
  readonly roleName?: string
  /** Provide an existing IAM role instead of creating one. When set, `roleName` is ignored. */
  readonly role?: IRole
  readonly alarmTopic: ITopic
  /** Override DLQ name. Defaults to `{queueName}-dlq`. */
  readonly dlqName?: string
  /** Override alarm name. Defaults to `{stage}-{serviceName}-{resourceName}-dlq-alarm`. */
  readonly alarmName?: string
  readonly additionalQueues?: IQueue[]
  readonly maxReceiveCount?: number
  /** Override queue visibility timeout. Defaults to `max(30s, timeout * 3)`. */
  readonly visibilityTimeout?: Duration
  readonly maxBatchingWindow?: Duration
  readonly maxConcurrency?: number
  readonly vpcConfig?: VpcConfig
  readonly architecture?: Architecture
  readonly runtime?: Runtime
  /**
   * Serverless function name for logical ID overrides (migration mode).
   * Overrides Lambda + log group logical IDs to match Serverless Framework naming.
   */
  readonly serverlessFunctionName?: string
  /**
   * Override CloudFormation logical IDs for queue resources (migration mode).
   */
  readonly overrideLogicalIds?: {
    readonly queue?: string
    readonly dlq?: string
    readonly alarm?: string
  }
}

export class LambdaWithQueue extends Construct {
  public readonly function: LambdaFunction

  public readonly queue: Queue

  public readonly dlq: Queue

  public readonly dlqAlarm: DlqAlarm

  constructor(scope: Construct, id: string, props: LambdaWithQueueProps) {
    super(scope, id)

    const resolved = resolveHandlerPath(props)
    const shortName = resolved.functionName
    const resourceName = props.resourceName ?? shortName
    const functionName = generateLambdaName(props.stage, props.serviceName, shortName)
    const handler = resolved.handler ?? props.handler ?? 'index.handler'
    const codePath = resolved.codePath ?? props.codePath ?? `./dist/handlers/${resourceName}`

    if (props.reservedConcurrency === 0) {
      throw new Error(
        `reservedConcurrency:0 disables the Lambda entirely for ${shortName}. Omit the prop to use account-level concurrency.`
      )
    }

    const {
      batchSize = 10,
      reportBatchItemFailures = true,
      additionalQueues = [],
      maxReceiveCount = 3
    } = props

    const memorySize = props.memorySize ?? 1024
    const timeout = props.timeout ?? Duration.seconds(15)
    const enableTracing = props.enableTracing ?? true

    this.dlq = new Queue(this, 'DLQ', {
      queueName: props.dlqName ?? `${props.queueName}-dlq`,
      retentionPeriod: Duration.days(14),
      removalPolicy: getRemovalPolicy(props.stage)
    })

    this.queue = new Queue(this, 'Queue', {
      queueName: props.queueName,
      visibilityTimeout:
        props.visibilityTimeout ?? Duration.seconds(Math.max(30, timeout.toSeconds() * 3)),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount
      },
      removalPolicy: getRemovalPolicy(props.stage)
    })

    const role: IRole = props.role ?? this.createRole(props)

    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: getLogRetentionDays(props.stage),
      removalPolicy: getRemovalPolicy(props.stage)
    })

    this.function = new LambdaFunction(this, 'Function', {
      functionName,
      runtime: props.runtime ?? DEFAULT_LAMBDA_RUNTIME,
      handler,
      code: Code.fromAsset(codePath),
      architecture: props.architecture ?? Architecture.ARM_64,
      memorySize,
      timeout,
      environment: {
        ...(props.environment ?? {}),
        ...buildRecapDevEnvironment(resolveRecapDevEndpoint(this))
      },
      role,
      reservedConcurrentExecutions: props.reservedConcurrency,
      tracing: enableTracing ? Tracing.ACTIVE : Tracing.DISABLED,
      logGroup,
      ...(props.vpcConfig && {
        vpc: props.vpcConfig.vpc,
        vpcSubnets: props.vpcConfig.vpcSubnets,
        securityGroups: props.vpcConfig.securityGroups
      })
    })

    this.function.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize,
        reportBatchItemFailures,
        ...(props.maxBatchingWindow && { maxBatchingWindow: props.maxBatchingWindow }),
        ...(props.maxConcurrency !== undefined && { maxConcurrency: props.maxConcurrency })
      })
    )

    applyStandardTags(this.function, {
      stage: props.stage,
      serviceName: props.serviceName,
      ...props.tags
    })

    applyStandardTags(this.queue, {
      stage: props.stage,
      serviceName: props.serviceName,
      ...props.tags
    })

    applyStandardTags(this.dlq, {
      stage: props.stage,
      serviceName: props.serviceName,
      ...props.tags
    })

    this.dlqAlarm = new DlqAlarm(this, 'DLQAlarm', {
      dlq: this.dlq,
      alarmName: props.alarmName ?? `${props.stage}-${props.serviceName}-${resourceName}-dlq-alarm`,
      alarmTopic: props.alarmTopic
    })

    additionalQueues.forEach(queue => {
      queue.grantSendMessages(this.function)
      queue.grantConsumeMessages(this.function)
    })

    // Serverless migration: override logical IDs
    if (props.serverlessFunctionName) {
      overrideFunctionLogicalIds(this.function, props.serverlessFunctionName)
    }

    if (props.overrideLogicalIds?.queue) {
      const cfnQueue = this.queue.node.defaultChild
      if (!(cfnQueue instanceof CfnQueue)) {
        throw new Error(
          `Cannot override queue logical ID "${props.overrideLogicalIds.queue}": defaultChild is not a CfnQueue.`
        )
      }
      cfnQueue.overrideLogicalId(props.overrideLogicalIds.queue)
    }

    if (props.overrideLogicalIds?.dlq) {
      const cfnDlq = this.dlq.node.defaultChild
      if (!(cfnDlq instanceof CfnQueue)) {
        throw new Error(
          `Cannot override DLQ logical ID "${props.overrideLogicalIds.dlq}": defaultChild is not a CfnQueue.`
        )
      }
      cfnDlq.overrideLogicalId(props.overrideLogicalIds.dlq)
    }

    if (props.overrideLogicalIds?.alarm) {
      const cfnAlarm = this.dlqAlarm.alarm.node.defaultChild
      if (!(cfnAlarm instanceof CfnAlarm)) {
        throw new Error(
          `Cannot override alarm logical ID "${props.overrideLogicalIds.alarm}": defaultChild is not a CfnAlarm.`
        )
      }
      cfnAlarm.overrideLogicalId(props.overrideLogicalIds.alarm)
    }
  }

  private createRole(props: LambdaWithQueueProps): IRole {
    if (!props.roleName) {
      throw new Error('LambdaWithQueue requires either `role` or `roleName` to be provided.')
    }

    const role = new Role(this, 'Role', {
      roleName: props.roleName,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: `Lambda execution role for ${props.serviceName}`
    })

    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    )

    if (props.vpcConfig) {
      role.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      )
    }

    return role
  }

  /**
   * Subscribe the queue to an SNS topic.
   *
   * **Migration note:** Pass `serverlessSubscriptionLogicalId` for Serverless→CDK migrations.
   * Without it, L2 `addSubscription()` generates a hash-suffixed logical ID that does not match
   * the existing Serverless stack resource, causing subscription deletion and recreation —
   * silently dropping in-flight messages during deploy.
   *
   * @param serverlessSubscriptionLogicalId - When set, uses `makeSnsToSqsSubscription` (L1)
   *   instead of `addSubscription()` and pins the CloudFormation logical ID to this value.
   *   Must match the logical ID of the existing `AWS::SNS::Subscription` in the live stack.
   */
  public subscribeToTopic(
    topic: ITopic,
    options?: SqsSubscriptionProps,
    serverlessSubscriptionLogicalId?: string
  ): void {
    if (serverlessSubscriptionLogicalId) {
      makeSnsToSqsSubscription(this, serverlessSubscriptionLogicalId, {
        topicArn: topic.topicArn,
        endpoint: this.queue.queueArn,
        protocol: 'sqs',
        rawMessageDelivery: options?.rawMessageDelivery
      })
    } else {
      topic.addSubscription(new SqsSubscription(this.queue, options))
    }
  }
}
