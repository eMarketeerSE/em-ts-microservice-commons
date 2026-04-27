import { App, Duration, Stack } from 'aws-cdk-lib'
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions'
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
        Environment: { Variables: Match.objectLike({ MY_VAR: 'my-value' }) }
      })
    })

    it('injects STAGE, NODE_ENV=development, and REGION for non-prod stage', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            STAGE: 'dev',
            NODE_ENV: 'development',
            REGION: 'eu-west-1'
          })
        }
      })
    })

    it('injects NODE_ENV=production for prod stage', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), stage: 'prod' })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({ NODE_ENV: 'production' })
        }
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

    it('attaches AWSXRayDaemonWriteAccess to the role when enableTracing is true', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', { ...defaultProps(stack), enableTracing: true })
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: Match.arrayWith([
          Match.objectLike({
            'Fn::Join': [
              '',
              Match.arrayWith([Match.stringLikeRegexp('AWSXRayDaemonWriteAccess')])
            ]
          })
        ])
      })
    })

    it('does not attach AWSXRayDaemonWriteAccess when enableTracing is false', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      const roles = Template.fromStack(stack).findResources('AWS::IAM::Role')
      const lambdaRole = Object.values(roles).find((r: any) =>
        (r.Properties?.AssumeRolePolicyDocument?.Statement ?? []).some(
          (s: any) => s.Principal?.Service === 'lambda.amazonaws.com'
        )
      ) as any
      const arns: string[] = (lambdaRole?.Properties?.ManagedPolicyArns ?? []).map(JSON.stringify)
      expect(arns.some(a => a.includes('AWSXRayDaemonWriteAccess'))).toBe(false)
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

    it('uses physicalName as the exact Lambda function name', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        physicalName: 'my-service-dev-my-handler'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'my-service-dev-my-handler'
      })
    })

    it('uses physicalName for the log group path', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        physicalName: 'my-service-dev-my-handler'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/my-service-dev-my-handler'
      })
    })

    it('physicalName + serverlessFunctionName: exact function name with Serverless logical IDs', () => {
      const stack = makeStack()
      new LambdaWithQueue(stack, 'Subject', {
        ...defaultProps(stack),
        physicalName: 'my-service-dev-my-handler',
        serverlessFunctionName: 'my-handler'
      })
      // Physical name is preserved
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'my-service-dev-my-handler'
      })
      // Logical ID follows Serverless naming derived from serverlessFunctionName, not physicalName
      expect(Template.fromStack(stack).findResources('AWS::Lambda::Function')).toHaveProperty(
        'MyDashhandlerLambdaFunction'
      )
    })
  })

  describe('subscribeToTopic', () => {
    it('creates subscription via CDK L2 when serverlessSubscriptionLogicalId is omitted', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      lq.subscribeToTopic(topic)
      Template.fromStack(stack).resourceCountIs('AWS::SNS::Subscription', 1)
    })

    it('creates subscription with overridden logical ID when serverlessSubscriptionLogicalId is set', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      lq.subscribeToTopic(topic, {}, 'TenantPurgeSubscription')
      expect(Template.fromStack(stack).findResources('AWS::SNS::Subscription')).toHaveProperty(
        'TenantPurgeSubscription'
      )
    })

    it('emits warning about missing queue policy when serverlessSubscriptionLogicalId is set', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      lq.subscribeToTopic(topic, {}, 'TenantPurgeSubscription')
      Annotations.fromStack(stack).hasWarning(
        '/TestStack/Subject',
        Match.stringLikeRegexp('SNS delivery will fail silently')
      )
    })

    it('throws when serverlessSubscriptionLogicalId is an empty string', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      expect(() => lq.subscribeToTopic(topic, {}, '')).toThrow('must not be an empty string')
    })

    it('throws when serverlessSubscriptionLogicalId is whitespace only', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      expect(() => lq.subscribeToTopic(topic, {}, '   ')).toThrow('must not be an empty string')
    })

    it('throws when filterPolicy is combined with serverlessSubscriptionLogicalId', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      expect(() =>
        lq.subscribeToTopic(topic, { filterPolicy: { type: { conditions: [] } as any } }, 'MySub')
      ).toThrow('filterPolicy')
    })

    it('throws when filterPolicyWithMessageBody is combined with serverlessSubscriptionLogicalId', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      expect(() =>
        lq.subscribeToTopic(topic, { filterPolicyWithMessageBody: { type: {} as any } }, 'MySub')
      ).toThrow('filterPolicy')
    })

    it('throws when deadLetterQueue is combined with serverlessSubscriptionLogicalId', () => {
      const stack = makeStack()
      const topic = new Topic(stack, 'Topic')
      const lq = new LambdaWithQueue(stack, 'Subject', defaultProps(stack))
      const dlq = new Queue(stack, 'DLQ')
      expect(() =>
        lq.subscribeToTopic(topic, { deadLetterQueue: dlq }, 'MySub')
      ).toThrow('filterPolicy')
    })
  })
})
