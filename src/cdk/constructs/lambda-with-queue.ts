import { Duration } from 'aws-cdk-lib'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime, Architecture, Tracing } from 'aws-cdk-lib/aws-lambda'
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { ITopic } from 'aws-cdk-lib/aws-sns'
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'
import { Stage, VpcConfig } from '../types'
import { applyStandardTags } from '../utils/tagging'
import { getLogRetentionDays, getRemovalPolicy } from '../utils/logs'
import { DlqAlarm } from './dlq-alarm'

export interface LambdaWithQueueProps {
  functionName: string
  queueName: string
  handlerPath: string
  reservedConcurrency: number
  batchSize: number
  reportBatchItemFailures: boolean
  stage: Stage
  serviceName: string
  environment: Record<string, string>
  memorySize: number
  timeout: Duration
  enableTracing: boolean
  tags: Record<string, string>
  roleName: string
  alarmTopic: ITopic | null
  snsTopics: ITopic[]
  rawMessageDelivery: boolean
  additionalQueues: Queue[]
  vpcConfig?: VpcConfig
}

export class LambdaWithQueue extends Construct {
  public readonly function: NodejsFunction

  public readonly queue: Queue

  public readonly dlq: Queue

  public readonly dlqAlarm?: DlqAlarm

  constructor(scope: Construct, id: string, props: LambdaWithQueueProps) {
    super(scope, id)

    const queueName = props.queueName

    this.dlq = new Queue(this, `${id}DLQ`, {
      queueName: `${queueName}-dlq`,
      retentionPeriod: Duration.days(14),
      removalPolicy: getRemovalPolicy(props.stage)
    })

    this.queue = new Queue(this, `${id}Queue`, {
      queueName,
      visibilityTimeout: Duration.seconds(props.timeout.toSeconds() * 3),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 3
      },
      removalPolicy: getRemovalPolicy(props.stage)
    })

    const role = new Role(this, `${id}Role`, {
      roleName: props.roleName,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: `Lambda execution role for ${props.serviceName}`
    })

    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    )

    const logGroup = new LogGroup(this, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${props.functionName}`,
      retention: getLogRetentionDays(props.stage),
      removalPolicy: getRemovalPolicy(props.stage)
    })

    this.function = new NodejsFunction(this, `${id}Function`, {
      functionName: props.functionName,
      entry: props.handlerPath,
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: props.memorySize,
      timeout: props.timeout,
      environment: props.environment,
      role,
      reservedConcurrentExecutions: props.reservedConcurrency,
      tracing: props.enableTracing ? Tracing.ACTIVE : Tracing.DISABLED,
      logGroup,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node22'
      },
      ...(props.vpcConfig && {
        vpc: props.vpcConfig.vpc,
        vpcSubnets: props.vpcConfig.vpcSubnets,
        securityGroups: props.vpcConfig.securityGroups
      })
    })

    this.function.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: props.batchSize,
        reportBatchItemFailures: props.reportBatchItemFailures
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
      this.dlqAlarm = new DlqAlarm(this, `${id}DLQAlarm`, {
        dlq: this.dlq,
        alarmName: `${props.stage}-${props.serviceName}-${props.queueName}-dlq-alarm`,
        alarmTopic: props.alarmTopic
      })
    }

    if (props.snsTopics.length > 0) {
      props.snsTopics.forEach(topic => {
        topic.addSubscription(
          new SqsSubscription(this.queue, {
            rawMessageDelivery: props.rawMessageDelivery
          })
        )
      })
    }

    if (props.additionalQueues.length > 0) {
      props.additionalQueues.forEach(queue => {
        queue.grantSendMessages(this.function)
        queue.grantConsumeMessages(this.function)
      })
    }
  }
}
