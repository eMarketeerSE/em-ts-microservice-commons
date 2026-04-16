import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { EmSnsTopic } from '../constructs/sns'

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

describe('EmSnsTopic', () => {
  describe('overrideLogicalId', () => {
    it('overrides the topic logical ID when provided', () => {
      const stack = makeStack()
      new EmSnsTopic(stack, 'Subject', {
        stage: 'dev',
        serviceName: 'test-service',
        topicName: 'contact-answered-form',
        overrideLogicalId: 'ContactAnsweredFormTopic'
      })

      const template = Template.fromStack(stack)
      const topics = template.findResources('AWS::SNS::Topic')
      expect(topics).toHaveProperty('ContactAnsweredFormTopic')
    })

    it('uses CDK default logical ID when not provided', () => {
      const stack = makeStack()
      new EmSnsTopic(stack, 'Subject', {
        stage: 'dev',
        serviceName: 'test-service',
        topicName: 'events'
      })

      const template = Template.fromStack(stack)
      const topics = template.findResources('AWS::SNS::Topic')
      expect(topics).not.toHaveProperty('ContactAnsweredFormTopic')
      expect(Object.keys(topics)).toHaveLength(1)
    })
  })

  describe('fromName', () => {
    it('imports a topic with the correct ARN', () => {
      const stack = makeStack()
      const topic = EmSnsTopic.fromName(stack, 'ContactEvent', {
        stage: 'dev',
        topicName: 'emarketeer-event-contact-event'
      })

      // The ARN should resolve to the expected pattern
      const resolved = stack.resolve(topic.topicArn)
      expect(resolved).toEqual({
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':sns:',
            { Ref: 'AWS::Region' },
            ':',
            { Ref: 'AWS::AccountId' },
            ':dev-emarketeer-event-contact-event'
          ]
        ]
      })
    })
  })
})
