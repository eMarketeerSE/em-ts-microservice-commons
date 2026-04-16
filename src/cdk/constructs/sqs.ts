/**
 * Common SQS queue construct with standard configurations
 */

import { Aws, Duration } from 'aws-cdk-lib'
import { Queue, QueueEncryption, DeadLetterQueue } from 'aws-cdk-lib/aws-sqs'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { SqsQueueConfig, Stage } from '../types'
import { generateQueueName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { getRemovalPolicy } from '../utils/logs'

/**
 * Standard SQS queue construct with eMarketeer defaults
 */
export class EmSqsQueue extends Construct {
  public readonly queue: Queue
  public readonly deadLetterQueue?: Queue

  constructor(scope: Construct, id: string, config: SqsQueueConfig) {
    super(scope, id)

    const queueName = generateQueueName(config.stage, config.serviceName, config.queueName)

    // Create Dead Letter Queue if enabled
    if (config.enableDLQ) {
      const dlqName = `${queueName}-dlq`
      this.deadLetterQueue = new Queue(this, 'DLQ', {
        queueName: dlqName,
        retentionPeriod: config.dlqRetentionPeriod || Duration.days(14),
        encryption: QueueEncryption.SQS_MANAGED,
        fifo: config.fifo,
        contentBasedDeduplication: config.fifo ? config.contentBasedDeduplication : undefined,
        removalPolicy: getRemovalPolicy(config.stage)
      })

      applyStandardTags(this.deadLetterQueue, {
        stage: config.stage,
        serviceName: config.serviceName,
        customTags: config.tags
      })
    }

    // Create main queue
    this.queue = new Queue(this, 'Queue', {
      queueName: config.fifo ? `${queueName}.fifo` : queueName,
      visibilityTimeout: config.visibilityTimeout || Duration.seconds(30),
      retentionPeriod: config.retentionPeriod || Duration.days(4),
      receiveMessageWaitTime: config.receiveMessageWaitTime || Duration.seconds(0),
      encryption: QueueEncryption.SQS_MANAGED,
      fifo: config.fifo,
      contentBasedDeduplication: config.fifo ? config.contentBasedDeduplication : undefined,
      deadLetterQueue: this.deadLetterQueue
        ? {
            queue: this.deadLetterQueue,
            maxReceiveCount: config.maxReceiveCount || 3
          }
        : undefined,
      removalPolicy: getRemovalPolicy(config.stage)
    })

    // Apply standard tags
    applyStandardTags(this.queue, {
      stage: config.stage,
      serviceName: config.serviceName,
      customTags: config.tags
    })
  }

  /**
   * Get the queue
   */
  public getQueue(): Queue {
    return this.queue
  }

  /**
   * Get the queue ARN
   */
  public getQueueArn(): string {
    return this.queue.queueArn
  }

  /**
   * Get the queue URL
   */
  public getQueueUrl(): string {
    return this.queue.queueUrl
  }

  /**
   * Get the queue name
   */
  public getQueueName(): string {
    return this.queue.queueName
  }

  /**
   * Get the dead letter queue
   */
  public getDeadLetterQueue(): Queue | undefined {
    return this.deadLetterQueue
  }

  /**
   * Grant send messages permissions to a grantee
   */
  public grantSendMessages(grantee: IGrantable) {
    return this.queue.grantSendMessages(grantee)
  }

  /**
   * Grant consume messages permissions to a grantee
   */
  public grantConsumeMessages(grantee: IGrantable) {
    return this.queue.grantConsumeMessages(grantee)
  }

  /**
   * Build an SQS queue URL by name convention.
   * Returns `https://sqs.{region}.amazonaws.com/{account}/{stage}-{queueName}`.
   *
   * @example
   * ```typescript
   * const url = EmSqsQueue.urlFromName(this, 'dev', 'em-contacts-service-contact-source')
   * ```
   */
  static urlFromName(scope: Construct, stage: Stage, queueName: string): string {
    const fullName = `${stage}-${queueName}`
    return `https://sqs.${Aws.REGION}.amazonaws.com/${Aws.ACCOUNT_ID}/${fullName}`
  }
}

/**
 * Helper function to create an SQS queue
 */
export const createQueue = (scope: Construct, id: string, config: SqsQueueConfig): EmSqsQueue => {
  return new EmSqsQueue(scope, id, config)
}

/**
 * Helper function to create a FIFO queue
 */
export const createFifoQueue = (
  scope: Construct,
  id: string,
  config: Omit<SqsQueueConfig, 'fifo'>
): EmSqsQueue => {
  return new EmSqsQueue(scope, id, {
    ...config,
    fifo: true,
    contentBasedDeduplication: true
  })
}

/**
 * Helper function to create a queue with DLQ
 */
export const createQueueWithDLQ = (
  scope: Construct,
  id: string,
  config: Omit<SqsQueueConfig, 'enableDLQ'>
): EmSqsQueue => {
  return new EmSqsQueue(scope, id, {
    ...config,
    enableDLQ: true
  })
}
