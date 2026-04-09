import { App, Stack } from 'aws-cdk-lib'
import { EmSqsQueue } from '../constructs/sqs'

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
