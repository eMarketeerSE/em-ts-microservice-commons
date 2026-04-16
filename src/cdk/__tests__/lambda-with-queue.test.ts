import { App, Duration, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
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

    it('prefixes functionName with stage and serviceName', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-my-handler'
      })
    })

    it('defaults to ARM_64 architecture', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64']
      })
    })

    it('defaults to index.handler', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'index.handler'
      })
    })

    it('defaults memorySize to 1024', () => {
      const stack = makeStack()
      const { memorySize: _, ...propsWithoutMemory } = defaultProps(stack)
      new LambdaWithQueue(stack, 'Subject', propsWithoutMemory)
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 1024
      })
    })

    it('defaults timeout to 15 seconds', () => {
      const stack = makeStack()
      const { timeout: _, ...propsWithoutTimeout } = defaultProps(stack)
      new LambdaWithQueue(stack, 'Subject', propsWithoutTimeout)
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 15
      })
    })

    it('defaults enableTracing to true', () => {
      const stack = makeStack()
      const { enableTracing: _, ...propsWithoutTracing } = defaultProps(stack)
      new LambdaWithQueue(stack, 'Subject', propsWithoutTracing)
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        TracingConfig: { Mode: 'Active' }
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
      // defaultProps has enableTracing: false — CDK omits TracingConfig when disabled
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

    it('uses custom dlqName when provided', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        dlqName: 'my-queue-dead-letter-queue'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue-dead-letter-queue'
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

    it('uses custom visibilityTimeout when provided', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        visibilityTimeout: Duration.seconds(1440)
      })
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'my-queue',
        VisibilityTimeout: 1440
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

    it('uses custom alarmName when provided', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        alarmName: 'custom-alarm-name'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'custom-alarm-name'
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

  describe('handlerPath', () => {
    it('derives functionName, handler, and codePath from handlerPath', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        functionName: undefined,
        handlerPath: 'src/handlers/process-jobs',
        codePath: CODE_PATH,
        roleName: 'my-role'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-process-jobs',
        Handler: 'index.handler'
      })
    })

    it('throws when neither handlerPath nor functionName is provided', () => {
      const stack = makeStack()
      expect(
        () =>
          new LambdaWithQueue(stack, 'Subject', {
            ...defaultProps(stack),
            functionName: undefined,
            codePath: undefined
          })
      ).toThrow('Either `handlerPath` or `functionName` must be provided.')
    })
  })

  describe('role injection', () => {
    it('uses provided role instead of creating one', () => {
      const stack = makeStack()
      const externalRole = new Role(stack, 'SharedRole', {
        roleName: 'shared-role',
        assumedBy: new ServicePrincipal('lambda.amazonaws.com')
      })
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        role: externalRole,
        roleName: undefined
      })
      // Only 1 IAM role (the external one), not 2
      Template.fromStack(stack).resourceCountIs('AWS::IAM::Role', 1)
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'shared-role'
      })
    })

    it('throws when neither role nor roleName is provided', () => {
      const stack = makeStack()
      expect(
        () =>
          new LambdaWithQueue(stack, 'Subject', {
            ...defaultProps(stack),
            roleName: undefined,
            role: undefined
          })
      ).toThrow('LambdaWithQueue requires either `role` or `roleName` to be provided.')
    })
  })

  describe('serverless migration', () => {
    it('overrides Lambda logical ID when serverlessFunctionName is set', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        serverlessFunctionName: 'process-jobs'
      })
      const template = Template.fromStack(stack)
      const functions = template.findResources('AWS::Lambda::Function')
      expect(functions).toHaveProperty('ProcessDashjobsLambdaFunction')
    })

    it('overrides log group logical ID when serverlessFunctionName is set', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        serverlessFunctionName: 'process-jobs'
      })
      const template = Template.fromStack(stack)
      const logGroups = template.findResources('AWS::Logs::LogGroup')
      expect(logGroups).toHaveProperty('ProcessDashjobsLogGroup')
    })

    it('overrides queue logical ID when overrideLogicalIds.queue is set', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        overrideLogicalIds: { queue: 'SQSQueueProcessJobs' }
      })
      const template = Template.fromStack(stack)
      const queues = template.findResources('AWS::SQS::Queue')
      expect(queues).toHaveProperty('SQSQueueProcessJobs')
    })

    it('overrides DLQ logical ID when overrideLogicalIds.dlq is set', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        overrideLogicalIds: { dlq: 'SQSQueueProcessJobsDLQ' }
      })
      const template = Template.fromStack(stack)
      const queues = template.findResources('AWS::SQS::Queue')
      expect(queues).toHaveProperty('SQSQueueProcessJobsDLQ')
    })

    it('overrides alarm logical ID when overrideLogicalIds.alarm is set', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        overrideLogicalIds: { alarm: 'ProcessJobsDLQAlarm' }
      })
      const template = Template.fromStack(stack)
      const alarms = template.findResources('AWS::CloudWatch::Alarm')
      expect(alarms).toHaveProperty('ProcessJobsDLQAlarm')
    })
  })
})
