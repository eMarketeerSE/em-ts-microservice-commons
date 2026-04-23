import { App, Duration } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { EmStack, EmStackProps } from '../constructs/stack'

const CODE_PATH = __dirname

function defaultProps(): EmStackProps {
  return {
    stage: 'dev',
    serviceName: 'test-service',
    env: { account: '123456789012', region: 'eu-west-1' }
  }
}

function makeStack(props?: Partial<EmStackProps>) {
  const app = new App()
  return new EmStack(app, 'TestStack', { ...defaultProps(), ...props })
}

describe('EmStack', () => {
  describe('synth', () => {
    it('synthesises without error', () => {
      expect(() => makeStack()).not.toThrow()
    })
  })

  describe('stack name', () => {
    it('auto-generates stack name as {stage}-{serviceName}-stack', () => {
      const stack = makeStack()
      expect(stack.stackName).toBe('dev-test-service-stack')
    })

    it('uses {serviceName}-{stage} when useSharedRole is true', () => {
      const stack = makeStack({ useSharedRole: true })
      expect(stack.stackName).toBe('test-service-dev')
    })

    it('allows overriding stackName', () => {
      const stack = makeStack({ stackName: 'custom-name' })
      expect(stack.stackName).toBe('custom-name')
    })
  })

  describe('description', () => {
    it('auto-generates description', () => {
      const stack = makeStack()
      expect(stack.templateOptions.description).toBe('test-service (dev)')
    })

    it('allows overriding description', () => {
      const stack = makeStack({ description: 'Custom description' })
      expect(stack.templateOptions.description).toBe('Custom description')
    })
  })

  describe('properties', () => {
    it('exposes stage', () => {
      expect(makeStack().stage).toBe('dev')
    })

    it('exposes serviceName', () => {
      expect(makeStack().serviceName).toBe('test-service')
    })

    it('sharedRole is undefined when useSharedRole is not set', () => {
      expect(makeStack().sharedRole).toBeUndefined()
    })
  })

  describe('tags', () => {
    it('applies standard tags (Stage, Service, ManagedBy)', () => {
      const app = new App()
      const stack = new EmStack(app, 'TestStack', defaultProps())
      const tags = app.synth().getStackByName(stack.stackName).tags
      expect(tags).toMatchObject({
        Stage: 'dev',
        Service: 'test-service',
        ManagedBy: 'CDK'
      })
    })

    it('applies custom tags', () => {
      const app = new App()
      const stack = new EmStack(app, 'TestStack', {
        ...defaultProps(),
        tags: { 'em-microservice': 'dev-test-service' }
      })
      const tags = app.synth().getStackByName(stack.stackName).tags
      expect(tags).toMatchObject({ 'em-microservice': 'dev-test-service' })
    })

    it('applies owner tag when provided', () => {
      const app = new App()
      const stack = new EmStack(app, 'TestStack', {
        ...defaultProps(),
        owner: 'platform-team'
      })
      const tags = app.synth().getStackByName(stack.stackName).tags
      expect(tags).toMatchObject({ Owner: 'platform-team' })
    })
  })

  describe('shared role (useSharedRole)', () => {
    it('creates a shared role with IamRoleLambdaExecution logical ID', () => {
      const stack = makeStack({ useSharedRole: true })
      const template = Template.fromStack(stack)
      const roles = template.findResources('AWS::IAM::Role')
      expect(roles).toHaveProperty('IamRoleLambdaExecution')
    })

    it('names the role {serviceName}-{stage}-{region}-lambdaRole', () => {
      const stack = makeStack({ useSharedRole: true })
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-service-dev-eu-west-1-lambdaRole'
      })
    })

    it('includes AWSLambdaBasicExecutionRole by default', () => {
      const stack = makeStack({ useSharedRole: true })
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
          },
          {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy'
              ]
            ]
          }
        ]
      })
    })

    it('exposes the shared role', () => {
      const stack = makeStack({ useSharedRole: true })
      expect(stack.sharedRole).toBeDefined()
    })
  })

  describe('createFunction', () => {
    it('defaults stage and serviceName from the stack', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        functionName: 'my-handler',
        handler: 'index.handler',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-my-handler'
      })
    })

    it('creates per-function role when useSharedRole is not set', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        functionName: 'my-handler',
        handler: 'index.handler',
        codePath: CODE_PATH
      })

      const template = Template.fromStack(stack)
      const roles = template.findResources('AWS::IAM::Role')
      expect(roles).not.toHaveProperty('IamRoleLambdaExecution')
      expect(Object.keys(roles).length).toBeGreaterThan(0)
    })

    it('does NOT override logical IDs when useSharedRole is not set', () => {
      const stack = makeStack()
      stack.createFunction('CaptureScreenshot', {
        functionName: 'capture-screenshot-from-url',
        handler: 'index.handler',
        codePath: CODE_PATH
      })

      const template = Template.fromStack(stack)
      const functions = template.findResources('AWS::Lambda::Function')
      // CDK default logical ID, NOT Serverless naming
      expect(functions).not.toHaveProperty('CaptureDashscreenshotDashfromDashurlLambdaFunction')
    })

    describe('with useSharedRole (migration mode)', () => {
      it('overrides Lambda logical ID to Serverless naming', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('CaptureScreenshot', {
          functionName: 'capture-screenshot-from-url',
          handler: 'index.handler',
          codePath: CODE_PATH
        })

        const template = Template.fromStack(stack)
        const functions = template.findResources('AWS::Lambda::Function')
        expect(functions).toHaveProperty('CaptureDashscreenshotDashfromDashurlLambdaFunction')
      })

      it('overrides log group logical ID', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('CaptureScreenshot', {
          functionName: 'capture-screenshot-from-url',
          handler: 'index.handler',
          codePath: CODE_PATH
        })

        const template = Template.fromStack(stack)
        const logGroups = template.findResources('AWS::Logs::LogGroup')
        expect(logGroups).toHaveProperty('CaptureDashscreenshotDashfromDashurlLogGroup')
      })

      it('sets log group deletion policy to Retain', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('CaptureScreenshot', {
          functionName: 'capture-screenshot-from-url',
          handler: 'index.handler',
          codePath: CODE_PATH
        })

        const template = Template.fromStack(stack)
        const logGroups = template.findResources('AWS::Logs::LogGroup')
        expect(logGroups['CaptureDashscreenshotDashfromDashurlLogGroup'].DeletionPolicy).toBe(
          'Retain'
        )
      })

      it('uses the shared role', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('CaptureScreenshot', {
          functionName: 'capture-screenshot-from-url',
          handler: 'index.handler',
          codePath: CODE_PATH
        })

        Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
          Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution', 'Arn'] }
        })
      })

      it('handles multiple functions', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('Fn1', {
          functionName: 'capture-screenshot-from-url',
          handler: 'index.handler',
          codePath: CODE_PATH
        })
        stack.createFunction('Fn2', {
          functionName: 'generate-pdf-from-url',
          handler: 'index.handler',
          codePath: CODE_PATH
        })

        const template = Template.fromStack(stack)
        const functions = template.findResources('AWS::Lambda::Function')
        expect(functions).toHaveProperty('CaptureDashscreenshotDashfromDashurlLambdaFunction')
        expect(functions).toHaveProperty('GenerateDashpdfDashfromDashurlLambdaFunction')
      })

    describe('physicalName', () => {
      it('sets FunctionName directly, bypassing generateLambdaName', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('GetScoreBreakdown', {
          functionName: 'get-score-breakdown',
          handler: 'index.handler',
          codePath: CODE_PATH,
          physicalName: 'em-contacts-service-dev-get-score-breakdown'
        })

        Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'em-contacts-service-dev-get-score-breakdown'
        })
      })

      it('sets log group name from physicalName', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('GetScoreBreakdown', {
          functionName: 'get-score-breakdown',
          handler: 'index.handler',
          codePath: CODE_PATH,
          physicalName: 'em-contacts-service-dev-get-score-breakdown'
        })

        Template.fromStack(stack).hasResourceProperties('AWS::Logs::LogGroup', {
          LogGroupName: '/aws/lambda/em-contacts-service-dev-get-score-breakdown'
        })
      })

      it('logical ID is still derived from functionName, not physicalName', () => {
        const stack = makeStack({ useSharedRole: true })
        stack.createFunction('GetScoreBreakdown', {
          functionName: 'get-score-breakdown',
          handler: 'index.handler',
          codePath: CODE_PATH,
          physicalName: 'em-contacts-service-dev-get-score-breakdown'
        })

        const template = Template.fromStack(stack)
        const functions = template.findResources('AWS::Lambda::Function')
        // Logical ID from functionName ('get-score-breakdown'), not physicalName
        expect(functions).toHaveProperty('GetDashscoreDashbreakdownLambdaFunction')
      })

      it('works without useSharedRole', () => {
        const stack = makeStack()
        stack.createFunction('GetScoreBreakdown', {
          functionName: 'get-score-breakdown',
          handler: 'index.handler',
          codePath: CODE_PATH,
          physicalName: 'em-contacts-service-dev-get-score-breakdown'
        })

        Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'em-contacts-service-dev-get-score-breakdown'
        })
      })
    })
    })
  })

  describe('createFunction with handlerPath', () => {
    it('derives codePath, handler, and functionName from handlerPath', () => {
      const stack = makeStack()
      stack.createFunction('CaptureScreenshot', {
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-capture-screenshot-from-url',
        Handler: 'index.handler'
      })
    })

    it('strips .ts extension from handlerPath', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/get-data.ts',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-get-data',
        Handler: 'index.handler'
      })
    })

    it('allows overriding functionName when using handlerPath', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url',
        functionName: 'custom-name',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-custom-name'
      })
    })

    it('allows overriding handler when using handlerPath', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/get-data',
        handler: 'main.handle',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'main.handle'
      })
    })

    it('works with migration mode (useSharedRole)', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.createFunction('CaptureScreenshot', {
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url',
        codePath: CODE_PATH
      })

      const template = Template.fromStack(stack)
      const functions = template.findResources('AWS::Lambda::Function')
      expect(functions).toHaveProperty('CaptureDashscreenshotDashfromDashurlLambdaFunction')
    })

    it('handles paths without the src/handlers/ prefix', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        handlerPath: 'get-data',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-get-data'
      })
    })

    it('throws when neither handlerPath nor functionName are provided', () => {
      const stack = makeStack()
      expect(() => {
        stack.createFunction('Handler', {} as any)
      }).toThrow('Either `handlerPath` or `functionName` must be provided.')
    })
  })

  describe('defaultFunctionConfig', () => {
    it('applies default config to all functions', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          memorySize: 1536,
          timeout: Duration.seconds(30),
          enableTracing: true
        }
      })
      stack.createFunction('Handler', {
        functionName: 'my-handler',
        handler: 'index.handler',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 1536,
        Timeout: 30,
        TracingConfig: { Mode: 'Active' }
      })
    })

    it('per-function config overrides defaults', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          memorySize: 1536,
          timeout: Duration.seconds(30)
        }
      })
      stack.createFunction('Handler', {
        functionName: 'my-handler',
        handler: 'index.handler',
        codePath: CODE_PATH,
        memorySize: 512
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 512,
        Timeout: 30
      })
    })

    it('works with handlerPath', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          memorySize: 2048
        }
      })
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/get-data',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 2048,
        FunctionName: 'dev-test-service-get-data'
      })
    })
  })

  describe('addOutput', () => {
    it('creates output with sls-{service}-{stage}-{key} export name', () => {
      const stack = makeStack()
      stack.addOutput('ServiceEndpoint', 'https://example.com')

      const template = Template.fromStack(stack)
      const outputs = template.toJSON().Outputs
      const output = Object.values(outputs as Record<string, { Export: { Name: string } }>)[0]
      expect(output.Export.Name).toBe('sls-test-service-dev-ServiceEndpoint')
    })

    it('uses id as outputKey by default', () => {
      const stack = makeStack()
      stack.addOutput('ChromiumLayerArn', 'arn:aws:lambda:...')

      const template = Template.fromStack(stack)
      const outputs = template.toJSON().Outputs
      const output = Object.values(outputs as Record<string, { Export: { Name: string } }>)[0]
      expect(output.Export.Name).toBe('sls-test-service-dev-ChromiumLayerArn')
    })

    it('accepts a custom outputKey via options', () => {
      const stack = makeStack()
      stack.addOutput('Endpoint', 'https://example.com', { outputKey: 'ServiceEndpoint' })

      const template = Template.fromStack(stack)
      const outputs = template.toJSON().Outputs
      const output = Object.values(outputs as Record<string, { Export: { Name: string } }>)[0]
      expect(output.Export.Name).toBe('sls-test-service-dev-ServiceEndpoint')
    })
  })

  describe('createQueueConsumer', () => {
    it('creates Lambda, queue, DLQ, and alarm', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      stack.createQueueConsumer('ProcessJobs', {
        functionName: 'process-jobs',
        handler: 'index.handler',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-queue-jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-jobs-role'
      })

      const template = Template.fromStack(stack)
      template.resourceCountIs('AWS::Lambda::Function', 1)
      template.resourceCountIs('AWS::SQS::Queue', 2)
      template.resourceCountIs('AWS::CloudWatch::Alarm', 1)
    })

    it('defaults stage and serviceName from the stack', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      stack.createQueueConsumer('ProcessJobs', {
        functionName: 'process-jobs',
        handler: 'index.handler',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-queue-jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-jobs-role'
      })

      Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-test-service-process-jobs-dlq-alarm'
      })
    })

    it('uses shared role and overrides logical IDs in migration mode', () => {
      const stack = makeStack({ useSharedRole: true })
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      stack.createQueueConsumer('ProcessJobs', {
        functionName: 'process-jobs',
        handler: 'index.handler',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-queue-jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic
      })

      const template = Template.fromStack(stack)
      // Shared role — only 1 IAM role (the shared one), not 2
      template.resourceCountIs('AWS::IAM::Role', 1)
      // Function name prefixed with stage-serviceName
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-process-jobs'
      })
      // Lambda logical ID overridden to Serverless naming
      const functions = template.findResources('AWS::Lambda::Function')
      expect(functions).toHaveProperty('ProcessDashjobsLambdaFunction')
    })

    it('resolves handlerPath', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      stack.createQueueConsumer('ProcessJobs', {
        handlerPath: 'src/handlers/process-jobs',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-queue-jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-jobs-role'
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-process-jobs',
        Handler: 'index.handler'
      })
    })

    it('applies defaultFunctionConfig environment to queue consumers', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          environment: { DEFAULT_VAR: 'from-defaults' }
        }
      })
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      stack.createQueueConsumer('ProcessJobs', {
        functionName: 'process-jobs',
        handler: 'index.handler',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-queue-jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-jobs-role'
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({ DEFAULT_VAR: 'from-defaults' })
        }
      })
    })
  })

  describe('createTopicQueueConsumer', () => {
    it('creates Lambda, queue, DLQ, alarm, and SNS subscription', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      const sourceTopic = new Topic(stack, 'SourceTopic')
      stack.createTopicQueueConsumer('ProcessInvoices', {
        topic: sourceTopic,
        handlerPath: 'src/handlers/process-invoices',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-invoice-queue',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-invoices-role'
      })

      const template = Template.fromStack(stack)
      template.resourceCountIs('AWS::Lambda::Function', 1)
      template.resourceCountIs('AWS::SQS::Queue', 2)
      template.resourceCountIs('AWS::CloudWatch::Alarm', 1)
      template.resourceCountIs('AWS::SNS::Subscription', 1)
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'sqs'
      })
    })

    it('defaults stage and serviceName from the stack', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      const sourceTopic = new Topic(stack, 'SourceTopic')
      stack.createTopicQueueConsumer('ProcessInvoices', {
        topic: sourceTopic,
        functionName: 'process-invoices',
        handler: 'index.handler',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-invoice-queue',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-invoices-role'
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-process-invoices'
      })
    })

    it('applies defaultFunctionConfig environment', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          environment: { DEFAULT_VAR: 'from-defaults' }
        }
      })
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      const sourceTopic = new Topic(stack, 'SourceTopic')
      stack.createTopicQueueConsumer('ProcessInvoices', {
        topic: sourceTopic,
        handlerPath: 'src/handlers/process-invoices',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-invoice-queue',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-invoices-role'
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({ DEFAULT_VAR: 'from-defaults' })
        }
      })
    })

    it('uses shared role and overrides logical IDs in migration mode', () => {
      const stack = makeStack({ useSharedRole: true })
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      const sourceTopic = new Topic(stack, 'SourceTopic')
      stack.createTopicQueueConsumer('ProcessInvoices', {
        topic: sourceTopic,
        functionName: 'process-invoices',
        handler: 'index.handler',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-invoice-queue',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic
      })

      const template = Template.fromStack(stack)
      template.resourceCountIs('AWS::IAM::Role', 1)
      const functions = template.findResources('AWS::Lambda::Function')
      expect(functions).toHaveProperty('ProcessDashinvoicesLambdaFunction')
    })

    it('forwards subscriptionOptions to the SNS subscription', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      const sourceTopic = new Topic(stack, 'SourceTopic')
      stack.createTopicQueueConsumer('ProcessInvoices', {
        topic: sourceTopic,
        handlerPath: 'src/handlers/process-invoices',
        codePath: CODE_PATH,
        queueName: 'dev-test-service-invoice-queue',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        roleName: 'process-invoices-role',
        subscriptionOptions: {
          rawMessageDelivery: true
        }
      })

      Template.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
        RawMessageDelivery: true
      })
    })
  })

  describe('createScheduledFunction', () => {
    it('creates a Lambda and EventBridge rule', () => {
      const stack = makeStack()
      stack.createScheduledFunction('DailyReport', {
        handlerPath: 'src/handlers/daily-report',
        codePath: CODE_PATH,
        schedule: 'cron(0 8 * * ? *)'
      })

      const template = Template.fromStack(stack)
      template.resourceCountIs('AWS::Lambda::Function', 1)
      template.resourceCountIs('AWS::Events::Rule', 1)
    })

    it('sets the schedule expression', () => {
      const stack = makeStack()
      stack.createScheduledFunction('DailyReport', {
        handlerPath: 'src/handlers/daily-report',
        codePath: CODE_PATH,
        schedule: 'rate(1 day)'
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: 'rate(1 day)'
      })
    })

    it('uses shared role in migration mode', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.createScheduledFunction('DailyReport', {
        handlerPath: 'src/handlers/daily-report',
        codePath: CODE_PATH,
        schedule: 'cron(0 8 * * ? *)'
      })

      const template = Template.fromStack(stack)
      // Shared role — only 1 IAM role
      template.resourceCountIs('AWS::IAM::Role', 1)
      // Lambda logical ID overridden
      const functions = template.findResources('AWS::Lambda::Function')
      expect(functions).toHaveProperty('DailyDashreportLambdaFunction')
    })
  })

  describe('ssmParam', () => {
    function getSsmParameterDefaults(stack: EmStack): string[] {
      const params = Template.fromStack(stack).findParameters('*', {
        Type: 'AWS::SSM::Parameter::Value<String>'
      })
      return Object.values(params).map((p: any) => p.Default as string)
    }

    it('resolves service-scoped param as /{stage}/{serviceName}/{paramName}', () => {
      const stack = makeStack()
      stack.ssmParam('db-timeout')
      expect(getSsmParameterDefaults(stack)).toContain('/dev/test-service/db-timeout')
    })

    it('resolves raw param using paramName as-is when raw: true', () => {
      const stack = makeStack()
      stack.ssmParam('proxy_dbms_host', { raw: true })
      const defaults = getSsmParameterDefaults(stack)
      expect(defaults).toContain('proxy_dbms_host')
      expect(defaults.join()).not.toContain('/dev/')
      expect(defaults.join()).not.toContain('test-service')
    })

    it('ignores serviceName when raw: true', () => {
      const stack = makeStack()
      stack.ssmParam('proxy_dbms_host', { raw: true })
      const defaults = getSsmParameterDefaults(stack)
      expect(defaults).toContain('proxy_dbms_host')
      expect(defaults.join()).not.toContain('other-service')
    })

    it('respects serviceName option for service-scoped params', () => {
      const stack = makeStack()
      stack.ssmParam('api-key', { serviceName: 'em-form-service' })
      expect(getSsmParameterDefaults(stack)).toContain('/dev/em-form-service/api-key')
    })
  })

  describe('alarmTopic', () => {
    it('returns a topic with {stage}-alarm-email convention', () => {
      const stack = makeStack()
      const topic = stack.alarmTopic()
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
            ':dev-alarm-email'
          ]
        ]
      })
    })
  })

  describe('em-microservice tag', () => {
    it('auto-adds em-microservice tag to all resources', () => {
      const stack = makeStack()
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/test',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Tags: Match.arrayWith([
          Match.objectLike({ Key: 'em-microservice', Value: 'dev-test-service' })
        ])
      })
    })
  })

  describe('environment merge in defaultFunctionConfig', () => {
    it('merges default environment with per-function environment', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          environment: { SHARED_VAR: 'shared', OVERRIDE_ME: 'default' }
        }
      })
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/test',
        codePath: CODE_PATH,
        environment: { EXTRA_VAR: 'extra', OVERRIDE_ME: 'overridden' }
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            SHARED_VAR: 'shared',
            EXTRA_VAR: 'extra',
            OVERRIDE_ME: 'overridden'
          })
        }
      })
    })

    it('uses default environment when per-function has none', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          environment: { DEFAULT_VAR: 'hello' }
        }
      })
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/test',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({ DEFAULT_VAR: 'hello' })
        }
      })
    })
  })

  describe('IAM policy helpers', () => {
    it('addLambdaInvokePolicy adds lambda:InvokeFunction', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.addLambdaInvokePolicy()

      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow'
            })
          ])
        }
      })
    })

    it('addKinesisPolicy adds kinesis:PutRecord/PutRecords', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.addKinesisPolicy('signals')

      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['kinesis:PutRecord', 'kinesis:PutRecords'],
              Effect: 'Allow'
            })
          ])
        }
      })
    })

    it('addSnsPublishPolicy adds sns:Publish', () => {
      const stack = makeStack({ useSharedRole: true })
      const topic = new Topic(stack, 'TestTopic')
      stack.addSnsPublishPolicy(topic)

      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sns:Publish',
              Effect: 'Allow'
            })
          ])
        }
      })
    })

    it('addSqsSendPolicy adds sqs:SendMessage', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.addSqsSendPolicy('em-contacts-service-contact-source')

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

    it('addLambdaInvokePolicy scopes to service by default', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.addLambdaInvokePolicy()

      const template = Template.fromStack(stack)
      const policies = template.findResources('AWS::IAM::Policy')
      const policyJson = JSON.stringify(Object.values(policies)[0])
      expect(policyJson).toContain(':function:dev-test-service-*')
    })

    it('addLambdaInvokePolicy accepts custom pattern', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.addLambdaInvokePolicy('dev-other-service-*')

      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow'
            })
          ])
        }
      })
    })

    it('addSnsPublishPolicy accepts a topic name string', () => {
      const stack = makeStack({ useSharedRole: true })
      stack.addSnsPublishPolicy('emarketeer-event-contact-event')

      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sns:Publish',
              Effect: 'Allow'
            })
          ])
        }
      })
    })

    it('throws when shared role is not enabled', () => {
      const stack = makeStack()
      expect(() => stack.addLambdaInvokePolicy()).toThrow('requires useSharedRole: true')
    })
  })

  describe('setDefaultFunctionConfig', () => {
    it('applies defaults set after construction', () => {
      const stack = makeStack()
      stack.setDefaultFunctionConfig({
        environment: { SHARED_VAR: 'post-constructor' }
      })
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/test',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({ SHARED_VAR: 'post-constructor' })
        }
      })
    })

    it('merges with existing defaults', () => {
      const stack = makeStack({
        defaultFunctionConfig: {
          environment: { INITIAL: 'from-constructor' }
        }
      })
      stack.setDefaultFunctionConfig({
        environment: { ADDED: 'post-constructor' }
      })
      stack.createFunction('Handler', {
        handlerPath: 'src/handlers/test',
        codePath: CODE_PATH
      })

      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            INITIAL: 'from-constructor',
            ADDED: 'post-constructor'
          })
        }
      })
    })
  })
})
