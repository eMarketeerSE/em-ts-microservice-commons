/**
 * Common SNS topic construct with standard configurations
 */

import { RemovalPolicy } from 'aws-cdk-lib'
import { Topic, TopicProps } from 'aws-cdk-lib/aws-sns'
import { EmailSubscription, LambdaSubscription, SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { SnsTopicConfig } from '../types'
import { generateTopicName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { getRemovalPolicy } from '../utils/logs'

/**
 * Standard SNS topic construct with eMarketeer defaults
 */
export class EmSnsTopic extends Construct {
  public readonly topic: Topic

  constructor(scope: Construct, id: string, config: SnsTopicConfig) {
    super(scope, id)

    const topicName = generateTopicName(config.stage, config.serviceName, config.topicName)

    // Create topic
    this.topic = new Topic(this, `${id}Topic`, {
      topicName: config.fifo ? `${topicName}.fifo` : topicName,
      displayName: config.displayName || topicName,
      fifo: config.fifo,
      contentBasedDeduplication: config.fifo ? config.contentBasedDeduplication : undefined
    })

    // Apply standard tags
    applyStandardTags(this.topic, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Get the topic
   */
  public getTopic(): Topic {
    return this.topic
  }

  /**
   * Get the topic ARN
   */
  public getTopicArn(): string {
    return this.topic.topicArn
  }

  /**
   * Get the topic name
   */
  public getTopicName(): string {
    return this.topic.topicName
  }

  /**
   * Add an email subscription
   */
  public addEmailSubscription(email: string) {
    return this.topic.addSubscription(new EmailSubscription(email))
  }

  /**
   * Add a Lambda subscription
   */
  public addLambdaSubscription(lambda: LambdaFunction) {
    return this.topic.addSubscription(new LambdaSubscription(lambda))
  }

  /**
   * Add an SQS subscription
   */
  public addSqsSubscription(queue: Queue, rawMessageDelivery = false) {
    return this.topic.addSubscription(
      new SqsSubscription(queue, {
        rawMessageDelivery
      })
    )
  }

  /**
   * Grant publish permissions to a grantee
   */
  public grantPublish(grantee: any) {
    return this.topic.grantPublish(grantee)
  }
}

/**
 * Helper function to create an SNS topic
 */
export const createTopic = (
  scope: Construct,
  id: string,
  config: SnsTopicConfig
): EmSnsTopic => {
  return new EmSnsTopic(scope, id, config)
}

/**
 * Helper function to create a FIFO topic
 */
export const createFifoTopic = (
  scope: Construct,
  id: string,
  config: Omit<SnsTopicConfig, 'fifo'>
): EmSnsTopic => {
  return new EmSnsTopic(scope, id, {
    ...config,
    fifo: true,
    contentBasedDeduplication: true
  })
}
