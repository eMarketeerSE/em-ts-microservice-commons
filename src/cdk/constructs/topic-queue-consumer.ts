import { ITopic, Topic } from 'aws-cdk-lib/aws-sns'
import { SqsSubscription, SqsSubscriptionProps } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'
import { LambdaWithQueue, LambdaWithQueueProps } from './lambda-with-queue'

export interface TopicQueueConsumerProps extends LambdaWithQueueProps {
  /** The SNS topic to subscribe to. Can be an ITopic or a topic ARN string. */
  readonly topic: ITopic | string
  /** Options for the SQS subscription (e.g. rawMessageDelivery, filterPolicy). */
  readonly subscriptionOptions?: Omit<SqsSubscriptionProps, 'rawMessageDelivery'> & {
    rawMessageDelivery?: boolean
  }
  /** Migration only: pins SNS subscription logical ID to prevent recreation and in-flight message loss during Serverless→CDK deploy. */
  readonly serverlessSubscriptionLogicalId?: string
}

/**
 * Lambda function consuming messages from an SNS topic via an SQS queue.
 *
 * Combines SNS subscription → SQS queue → DLQ + alarm → Lambda consumer
 * in a single construct. Supports all `LambdaWithQueue` features including
 * migration mode (shared role, logical ID overrides).
 *
 * @example
 * ```typescript
 * // Import external topic by ARN or use EmSnsTopic.fromName()
 * const contactEventTopic = EmSnsTopic.fromName(this, 'ContactEvent', {
 *   stage: 'dev',
 *   topicName: 'emarketeer-event-contact-event',
 * })
 *
 * const consumer = new TopicQueueConsumer(this, 'ContactEvents', {
 *   topic: contactEventTopic,
 *   handlerPath: 'src/handlers/process-contact-event',
 *   queueName: 'dev-my-service-contact-event-queue',
 *   alarmTopic,
 * })
 * ```
 */
export class TopicQueueConsumer extends LambdaWithQueue {
  constructor(scope: Construct, id: string, props: TopicQueueConsumerProps) {
    const {
      topic: topicOrArn,
      subscriptionOptions,
      serverlessSubscriptionLogicalId,
      ...queueProps
    } = props
    super(scope, id, queueProps)

    const topic =
      typeof topicOrArn === 'string'
        ? Topic.fromTopicArn(this, 'SubscribedTopic', topicOrArn)
        : topicOrArn

    this.subscribeToTopic(topic, subscriptionOptions, serverlessSubscriptionLogicalId)
  }
}
