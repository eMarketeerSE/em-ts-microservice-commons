/**
 * Example: SQS Queue with Lambda processor
 */

import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { EmLambdaFunction, EmSqsQueue, EmSnsTopic } from '../constructs'

export class QueueExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stage = (process.env.STAGE || 'dev') as 'dev' | 'test' | 'staging' | 'prod'
    const serviceName = 'order-processor'

    // Create queue with DLQ
    const orderQueue = new EmSqsQueue(this, 'OrderQueue', {
      stage,
      serviceName,
      queueName: 'orders',
      visibilityTimeout: Duration.seconds(300),
      enableDLQ: true,
      maxReceiveCount: 3
    })

    // Create SNS topic
    const orderTopic = new EmSnsTopic(this, 'OrderTopic', {
      stage,
      serviceName,
      topicName: 'order-events',
      displayName: 'Order Events'
    })

    // Subscribe queue to topic
    orderTopic.addSqsSubscription(orderQueue.getQueue())

    // Create processor Lambda
    const processor = new EmLambdaFunction(this, 'OrderProcessor', {
      stage,
      serviceName,
      functionName: 'process-order',
      handler: 'handlers/processOrder.handler',
      codePath: './dist',
      timeout: Duration.minutes(5)
    })

    // Add SQS trigger
    processor.getFunction().addEventSource(
      new SqsEventSource(orderQueue.getQueue(), {
        batchSize: 10
      })
    )

    // Grant permissions
    orderQueue.grantConsumeMessages(processor.getFunction())
    orderTopic.grantPublish(processor.getFunction())
  }
}
