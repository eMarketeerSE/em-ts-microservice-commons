import { App, Duration, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { LambdaWithQueue, LambdaWithQueueProps } from '../constructs/lambda-with-queue'

const CODE_PATH = __dirname

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

function makeAlarmTopic(stack: Stack) {
  return new Topic(stack, 'AlarmTopic')
}

function defaultProps(stack: Stack): LambdaWithQueueProps {
  return {
    stage: 'dev',
    serviceName: 'test-service',
    functionName: 'my-handler',
    queueName: 'my-queue',
    roleName: 'my-role',
    memorySize: 512,
    timeout: Duration.seconds(30),
    enableTracing: false,
    alarmTopic: makeAlarmTopic(stack),
    codePath: CODE_PATH
  }
}

describe('LambdaWithQueue', () => {
  describe('synth', () => {
    it('synthesises without error', () => {
      const stack = makeStack()
      expect(() => new LambdaWithQueue(stack, 'Subject', defaultProps(stack))).not.toThrow()
    })

    it('throws when reservedConcurrency is 0', () => {
      const stack = makeStack()
      expect(
        () =>
          new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), reservedConcurrency: 0 })
      ).toThrow('reservedConcurrency:0 disables')
    })
  })

  describe('Lambda function', () => {
    it('creates one Lambda function', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).resourceCountIs('AWS::Lambda::Function', 1)
    })

    it('uses the provided functionName', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'my-handler'
      })
    })

    it('defaults to X86_64 architecture', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['x86_64']
      })
    })

    it('defaults to index.handler', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'index.handler'
      })
    })

    it('enables X-Ray tracing when enableTracing is true', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), enableTracing: true })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        TracingConfig: { Mode: 'Active' }
      })
    })

    it('disables X-Ray tracing when enableTracing is false', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      // CDK omits TracingConfig entirely when tracing is disabled — assert key is absent
      const template = Template.fromStack(stack).findResources('AWS::Lambda::Function')
      const fn = Object.values(template)[0]
      expect(fn.Properties.TracingConfig).toBeUndefined()
    })

    it('sets reservedConcurrentExecutions when provided', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), reservedConcurrency: 5 })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        ReservedConcurrentExecutions: 5
      })
    })

    it('injects custom environment variables', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        environment: { MY_VAR: 'my-value' }
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: { Variables: { MY_VAR: 'my-value' } }
      })
    })
  })

  describe('SQS queue', () => {
    it('creates queue and DLQ', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).resourceCountIs('AWS::SQS::Queue', 2)
    })

    it('names the queue correctly', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue'
      })
    })

    it('names the DLQ with -dlq suffix', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue-dlq'
      })
    })

    it('sets visibility timeout to 3x Lambda timeout', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      // 30s timeout * 3 = 90s
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue',
        VisibilityTimeout: 90
      })
    })

    it('enforces minimum visibility timeout of 30s', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        timeout: Duration.seconds(5)
      })
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue',
        VisibilityTimeout: 30
      })
    })

    it('uses custom maxReceiveCount', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), maxReceiveCount: 5 })
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue',
        RedrivePolicy: { maxReceiveCount: 5 }
      })
    })

    it('defaults maxReceiveCount to 3', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue',
        RedrivePolicy: { maxReceiveCount: 3 }
      })
    })
  })

  describe('IAM role', () => {
    it('creates a Lambda execution role', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'my-role',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' }
            }
          ]
        }
      })
    })

    it('attaches AWSLambdaBasicExecutionRole managed policy', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: [
          {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
              ]
            ]
          }
        ]
      })
    })
  })

  describe('CloudWatch alarm', () => {
    it('creates a DLQ alarm', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).resourceCountIs('AWS::CloudWatch::Alarm', 1)
    })

    it('alarm name uses stage, serviceName, and resourceName', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-test-service-my-handler-dlq-alarm'
      })
    })

    it('alarm name uses resourceName when provided', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), resourceName: 'short-name' })
      Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-test-service-short-name-dlq-alarm'
      })
    })
  })

  describe('event source mapping', () => {
    it('creates an SQS event source mapping', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).resourceCountIs('AWS::Lambda::EventSourceMapping', 1)
    })

    it('uses default batch size of 10', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        BatchSize: 10
      })
    })

    it('uses custom batch size when provided', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), batchSize: 5 })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        BatchSize: 5
      })
    })
  })

  describe('additionalQueues', () => {
    it('grants send and consume permissions to additional queues', () => {
      const stack = makeStack()
      const extraQueue = new Queue(stack, 'ExtraQueue')
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        additionalQueues: [extraQueue]
      })
      // Lambda role should have SQS policy for the extra queue — use arrayWith to match within multi-statement policy
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
              Effect: 'Allow'
            })
          ])
        }
      })
    })
  })
})
