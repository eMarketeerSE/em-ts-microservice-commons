/**
 * Common SNS topic construct with standard configurations
 */

import { Aws } from 'aws-cdk-lib'
import { CfnTopic, ITopic, Topic } from 'aws-cdk-lib/aws-sns'
import {
  EmailSubscription,
  LambdaSubscription,
  SqsSubscription
} from 'aws-cdk-lib/aws-sns-subscriptions'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { IGrantable } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { SnsTopicConfig, Stage } from '../types'
import { generateTopicName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'

/**
 * Standard SNS topic construct with eMarketeer defaults
 */
export class EmSnsTopic extends Construct {
  public readonly topic: Topic

  constructor(scope: Construct, id: string, config: SnsTopicConfig) {
    super(scope, id)

    const topicName =
      config.rawTopicName ?? generateTopicName(config.stage, config.serviceName, config.topicName)

    // Create topic
    this.topic = new Topic(this, 'Topic', {
      topicName: config.fifo ? `${topicName}.fifo` : topicName,
      displayName: config.displayName || topicName,
      fifo: config.fifo,
      contentBasedDeduplication: config.fifo ? config.contentBasedDeduplication : undefined
    })

    if (config.overrideLogicalId) {
      ;(this.topic.node.defaultChild as CfnTopic).overrideLogicalId(config.overrideLogicalId)
    }

    // Apply standard tags
    applyStandardTags(this.topic, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Import an external SNS topic by name convention.
   *
   * Builds the ARN as `arn:{partition}:sns:{region}:{account}:{stage}-{topicName}`
   * and returns an `ITopic` reference.
   *
   * @example
   * ```typescript
   * const contactEventTopic = EmSnsTopic.fromName(this, 'ContactEvent', {
   *   stage: 'dev',
   *   topicName: 'emarketeer-event-contact-event',
   * })
   * // ARN: arn:aws:sns:eu-west-1:123456789012:dev-emarketeer-event-contact-event
   * ```
   */
  static fromName(
    scope: Construct,
    id: string,
    config: { stage: Stage; topicName: string }
  ): ITopic {
    const fullName = `${config.stage}-${config.topicName}`
    const arn = `arn:${Aws.PARTITION}:sns:${Aws.REGION}:${Aws.ACCOUNT_ID}:${fullName}`
    return Topic.fromTopicArn(scope, id, arn)
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
  public grantPublish(grantee: IGrantable) {
    return this.topic.grantPublish(grantee)
  }
}

/**
 * Helper function to create an SNS topic
 */
export const createTopic = (scope: Construct, id: string, config: SnsTopicConfig): EmSnsTopic => {
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
