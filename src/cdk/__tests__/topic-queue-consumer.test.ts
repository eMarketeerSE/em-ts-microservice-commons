import { App, Duration, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { TopicQueueConsumer } from '../constructs/topic-queue-consumer'

const CODE_PATH = __dirname

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

describe('TopicQueueConsumer', () => {
  it('creates Lambda, queue, DLQ, alarm, and SNS subscription', () => {
    const stack = makeStack()
    const eventTopic = new Topic(stack, 'EventTopic')
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    new TopicQueueConsumer(stack, 'Subject', {
      topic: eventTopic,
      stage: 'dev',
      serviceName: 'test-service',
      functionName: 'process-event',
      queueName: 'dev-test-service-event-queue',
      alarmTopic,
      codePath: CODE_PATH,
      roleName: 'test-role'
    })

    const template = Template.fromStack(stack)
    template.resourceCountIs('AWS::Lambda::Function', 1)
    template.resourceCountIs('AWS::SQS::Queue', 2)
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1)
    template.resourceCountIs('AWS::SNS::Subscription', 1)
  })

  it('subscribes the queue to the topic', () => {
    const stack = makeStack()
    const eventTopic = new Topic(stack, 'EventTopic')
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    new TopicQueueConsumer(stack, 'Subject', {
      topic: eventTopic,
      stage: 'dev',
      serviceName: 'test-service',
      functionName: 'process-event',
      queueName: 'dev-test-service-event-queue',
      alarmTopic,
      codePath: CODE_PATH,
      roleName: 'test-role'
    })

    const template = Template.fromStack(stack)
    const queues = template.findResources('AWS::SQS::Queue')
    const mainQueueLogicalId = Object.keys(queues).find(id => !id.toLowerCase().includes('dlq'))!

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'sqs',
      TopicArn: Match.objectLike({ Ref: Match.stringLikeRegexp('^EventTopic') }),
      Endpoint: { 'Fn::GetAtt': [mainQueueLogicalId, 'Arn'] }
    })
  })

  it('accepts a topic ARN string', () => {
    const stack = makeStack()
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    new TopicQueueConsumer(stack, 'Subject', {
      topic: 'arn:aws:sns:eu-west-1:123456789012:dev-contact-events',
      stage: 'dev',
      serviceName: 'test-service',
      functionName: 'process-event',
      queueName: 'dev-test-service-event-queue',
      alarmTopic,
      codePath: CODE_PATH,
      roleName: 'test-role'
    })

    Template.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'sqs',
      TopicArn: 'arn:aws:sns:eu-west-1:123456789012:dev-contact-events'
    })
  })

  it('pins the subscription logical ID when serverlessSubscriptionLogicalId is provided', () => {
    const stack = makeStack()
    const eventTopic = new Topic(stack, 'EventTopic')
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    new TopicQueueConsumer(stack, 'Subject', {
      topic: eventTopic,
      stage: 'dev',
      serviceName: 'test-service',
      functionName: 'process-event',
      queueName: 'dev-test-service-event-queue',
      alarmTopic,
      codePath: CODE_PATH,
      roleName: 'test-role',
      serverlessSubscriptionLogicalId: 'ProcessEventSnsSubscription'
    })

    const template = Template.fromStack(stack)
    const subscriptions = template.findResources('AWS::SNS::Subscription')
    expect(subscriptions).toHaveProperty('ProcessEventSnsSubscription')

    const sub = subscriptions.ProcessEventSnsSubscription.Properties
    expect(sub.Protocol).toBe('sqs')
    expect(sub.TopicArn.Ref).toMatch(/^EventTopic/)
    expect(sub.Endpoint['Fn::GetAtt'][1]).toBe('Arn')
  })

  it('forwards rawMessageDelivery on the migration subscription path', () => {
    const stack = makeStack()
    const eventTopic = new Topic(stack, 'EventTopic')
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    new TopicQueueConsumer(stack, 'Subject', {
      topic: eventTopic,
      stage: 'dev',
      serviceName: 'test-service',
      functionName: 'process-event',
      queueName: 'dev-test-service-event-queue',
      alarmTopic,
      codePath: CODE_PATH,
      roleName: 'test-role',
      serverlessSubscriptionLogicalId: 'ProcessEventSnsSubscription',
      subscriptionOptions: { rawMessageDelivery: true }
    })

    const subscriptions = Template.fromStack(stack).findResources('AWS::SNS::Subscription')
    expect(subscriptions.ProcessEventSnsSubscription.Properties.RawMessageDelivery).toBe(true)
  })


  it('derives functionName from handlerPath', () => {
    const stack = makeStack()
    const eventTopic = new Topic(stack, 'EventTopic')
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    new TopicQueueConsumer(stack, 'Subject', {
      topic: eventTopic,
      stage: 'dev',
      serviceName: 'test-service',
      handlerPath: 'src/handlers/process-event',
      codePath: CODE_PATH,
      queueName: 'dev-test-service-event-queue',
      alarmTopic,
      roleName: 'test-role'
    })

    Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'dev-test-service-process-event'
    })
  })
})
