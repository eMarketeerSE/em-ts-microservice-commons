import { Duration } from 'aws-cdk-lib'
import { Queue, IQueue } from 'aws-cdk-lib/aws-sqs'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import {
  Function as LambdaFunction,
  Code,
  Architecture,
  Runtime,
  Tracing
} from 'aws-cdk-lib/aws-lambda'
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { ITopic } from 'aws-cdk-lib/aws-sns'
import { SqsSubscription, SqsSubscriptionProps } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'
import { Stage, VpcConfig } from '../types'
import { applyStandardTags } from '../utils/tagging'
import { getLogRetentionDays, getRemovalPolicy } from '../utils/logs'
import { buildRecapDevEnvironment, resolveRecapDevEndpoint } from '../utils/config'
import { DEFAULT_LAMBDA_RUNTIME } from '../utils/constants'
import { DlqAlarm } from './dlq-alarm'

export interface LambdaWithQueueProps {
  readonly functionName: string
  readonly queueName: string
  /** Short name used for codePath default and alarm naming. Defaults to functionName. */
  readonly resourceName?: string
  readonly handler?: string
  readonly codePath?: string
  readonly reservedConcurrency?: number
  readonly batchSize?: number
  readonly reportBatchItemFailures?: boolean
  readonly stage: Stage
  readonly serviceName: string
  readonly environment?: Record<string, string>
  readonly memorySize: number
  readonly timeout: Duration
  readonly enableTracing: boolean
  readonly tags?: Record<string, string>
  readonly roleName: string
  readonly alarmTopic: ITopic
  readonly additionalQueues?: IQueue[]
  readonly maxReceiveCount?: number
  readonly maxBatchingWindow?: Duration
  readonly maxConcurrency?: number
  readonly vpcConfig?: VpcConfig
  readonly architecture?: Architecture
  readonly runtime?: Runtime
}

export class LambdaWithQueue extends Construct {
  public readonly function: LambdaFunction

  public readonly queue: Queue

  public readonly dlq: Queue

  public readonly dlqAlarm: DlqAlarm

  constructor(scope: Construct, id: string, props: LambdaWithQueueProps) {
    super(scope, id)

    if (props.reservedConcurrency === 0) {
      throw new Error(
        `reservedConcurrency:0 disables the Lambda entirely for ${props.functionName}. Omit the prop to use account-level concurrency.`
      )
    }

    const {
      batchSize = 10,
      reportBatchItemFailures = true,
      additionalQueues = [],
      maxReceiveCount = 3
    } = props

    const resourceName = props.resourceName ?? props.functionName

    this.dlq = new Queue(this, 'DLQ', {
      queueName: `${props.queueName}-dlq`,
      retentionPeriod: Duration.days(14),
      removalPolicy: getRemovalPolicy(props.stage)
    })

    this.queue = new Queue(this, 'Queue', {
      queueName: props.queueName,
      visibilityTimeout: Duration.seconds(Math.max(30, props.timeout.toSeconds() * 3)),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount
      },
      removalPolicy: getRemovalPolicy(props.stage)
    })

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

    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${props.functionName}`,
      retention: getLogRetentionDays(props.stage),
      removalPolicy: getRemovalPolicy(props.stage)
    })

    this.function = new LambdaFunction(this, 'Function', {
      functionName: props.functionName,
      runtime: props.runtime ?? DEFAULT_LAMBDA_RUNTIME,
      handler: props.handler ?? 'index.handler',
      code: Code.fromAsset(props.codePath ?? `./dist/handlers/${resourceName}`),
      architecture: props.architecture ?? Architecture.X86_64,
      memorySize: props.memorySize,
      timeout: props.timeout,
      environment: {
        ...(props.environment ?? {}),
        ...buildRecapDevEnvironment(resolveRecapDevEndpoint(this))
      },
      role,
      reservedConcurrentExecutions: props.reservedConcurrency,
      tracing: props.enableTracing ? Tracing.ACTIVE : Tracing.DISABLED,
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
      alarmName: `${props.stage}-${props.serviceName}-${resourceName}-dlq-alarm`,
      alarmTopic: props.alarmTopic
    })

    additionalQueues.forEach(queue => {
      queue.grantSendMessages(this.function)
      queue.grantConsumeMessages(this.function)
    })
  }

  public subscribeToTopic(topic: ITopic, options?: SqsSubscriptionProps) {
    topic.addSubscription(new SqsSubscription(this.queue, options))
  }
}
