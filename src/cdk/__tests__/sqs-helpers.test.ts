import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { EmSqsQueue, createFifoQueue } from '../constructs/sqs'

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

describe('EmSqsQueue.urlFromName', () => {
  it('builds a queue URL with stage prefix', () => {
    const stack = makeStack()
    const url = EmSqsQueue.urlFromName(stack, 'dev', 'em-contacts-service-contact-source')
    const resolved = stack.resolve(url)

    expect(resolved).toEqual({
      'Fn::Join': [
        '',
        [
          'https://sqs.',
          { Ref: 'AWS::Region' },
          '.amazonaws.com/',
          { Ref: 'AWS::AccountId' },
          '/dev-em-contacts-service-contact-source'
        ]
      ]
    })
  })
})

describe('createFifoQueue', () => {
  it('with enableDLQ names the dead-letter queue with the .fifo suffix', () => {
    const stack = makeStack()
    createFifoQueue(stack, 'Subject', {
      stage: 'dev',
      serviceName: 'test-service',
      queueName: 'jobs',
      enableDLQ: true
    })
    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'dev-test-service-queue-jobs-dlq.fifo',
      FifoQueue: true
    })
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'dev-test-service-queue-jobs.fifo',
      FifoQueue: true
    })
  })
})
