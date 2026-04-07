import { Duration } from 'aws-cdk-lib'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import {
  Function as LambdaFunction,
  Runtime,
  Code,
  Architecture,
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
import { DlqAlarm } from './dlq-alarm'

export interface LambdaWithQueueProps {
  functionName: string
  queueName: string
  handler: string
  codePath: string
  reservedConcurrency?: number
  batchSize?: number
  reportBatchItemFailures?: boolean
  stage: Stage
  serviceName: string
  environment: Record<string, string>
  memorySize: number
  timeout: Duration
  enableTracing: boolean
  tags: Record<string, string>
  roleName: string
  alarmTopic: ITopic | null
  additionalQueues?: Queue[]
  maxReceiveCount?: number
  maxBatchingWindow?: Duration
  maxConcurrency?: number
  vpcConfig?: VpcConfig
}

export class LambdaWithQueue extends Construct {
  public readonly function: LambdaFunction

  public readonly queue: Queue

  public readonly dlq: Queue

  public readonly dlqAlarm?: DlqAlarm

  constructor(scope: Construct, id: string, props: LambdaWithQueueProps) {
    super(scope, id)

    const {
      batchSize = 10,
      reportBatchItemFailures = true,
      additionalQueues = [],
      maxReceiveCount = 3
    } = props

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
      runtime: Runtime.NODEJS_22_X,
      handler: props.handler,
      code: Code.fromAsset(props.codePath),
      architecture: Architecture.ARM_64,
      memorySize: props.memorySize,
      timeout: props.timeout,
      environment: {
        ...props.environment,
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

    if (props.alarmTopic !== null) {
      this.dlqAlarm = new DlqAlarm(this, 'DLQAlarm', {
        dlq: this.dlq,
        alarmName: `${props.stage}-${props.serviceName}-${props.queueName}-dlq-alarm`,
        alarmTopic: props.alarmTopic
      })
    }

    additionalQueues.forEach(queue => {
      queue.grantSendMessages(this.function)
      queue.grantConsumeMessages(this.function)
    })
  }

  public subscribeToTopic(topic: ITopic, options?: SqsSubscriptionProps) {
    topic.addSubscription(new SqsSubscription(this.queue, options))
  }
}
