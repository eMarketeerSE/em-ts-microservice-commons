import { App, Duration, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { EmLambdaFunction } from '../constructs/lambda'
import { LambdaConfig } from '../types'

const CODE_PATH = __dirname

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

function defaultConfig(): LambdaConfig {
  return {
    stage: 'dev',
    serviceName: 'test-service',
    functionName: 'my-handler',
    handler: 'index.handler',
    codePath: CODE_PATH
  }
}

describe('EmLambdaFunction', () => {
  describe('synth', () => {
    it('synthesises without error', () => {
      const stack = makeStack()
      expect(() => new EmLambdaFunction(stack, 'Subject', defaultConfig())).not.toThrow()
    })
  })

  describe('function name', () => {
    it('generates function name as stage-serviceName-functionName', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-test-service-my-handler'
      })
    })
  })

  describe('defaults', () => {
    it('defaults to ARM_64 architecture', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64']
      })
    })

    it('defaults to index.handler', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'index.handler'
      })
    })

    it('defaults to 1024 MB memory', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 1024
      })
    })

    it('defaults to 15s timeout', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 15
      })
    })

    it('disables tracing by default', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      // CDK omits TracingConfig entirely when tracing is disabled — assert key is absent
      const template = Template.fromStack(stack).findResources('AWS::Lambda::Function')
      const fn = Object.values(template)[0]
      expect(fn.Properties.TracingConfig).toBeUndefined()
    })
  })

  describe('overrides', () => {
    it('respects custom memory size', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', { ...defaultConfig(), memorySize: 2048 })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 2048
      })
    })

    it('respects custom timeout', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', { ...defaultConfig(), timeout: Duration.seconds(60) })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 60
      })
    })

    it('respects custom architecture', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', {
        ...defaultConfig(),
        architecture: Architecture.X86_64
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['x86_64']
      })
    })

    it('respects custom runtime', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', {
        ...defaultConfig(),
        runtime: Runtime.NODEJS_22_X
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs22.x'
      })
    })

    it('enables X-Ray tracing when enableTracing is true', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', { ...defaultConfig(), enableTracing: true })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        TracingConfig: { Mode: 'Active' }
      })
    })

    it('injects custom environment variables', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', {
        ...defaultConfig(),
        environment: { MY_VAR: 'my-value' }
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: { Variables: { MY_VAR: 'my-value' } }
      })
    })
  })

  describe('IAM role', () => {
    it('creates a Lambda execution role when no role is provided', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
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
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
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

  describe('log group', () => {
    it('creates a log group named /aws/lambda/{functionName}', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/dev-test-service-my-handler'
      })
    })
  })

  describe('description', () => {
    it('sets description as serviceName - functionName', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Description: 'test-service - my-handler'
      })
    })
  })

  describe('base environment variables', () => {
    it('injects STAGE, NODE_ENV=development, and REGION for non-prod stage', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', defaultConfig())
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
      new EmLambdaFunction(stack, 'Subject', { ...defaultConfig(), stage: 'prod' })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({ NODE_ENV: 'production' })
        }
      })
    })
  })

  describe('physicalName', () => {
    it('uses physicalName as the exact Lambda function name', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', {
        ...defaultConfig(),
        physicalName: 'my-service-dev-my-handler'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'my-service-dev-my-handler'
      })
    })

    it('uses physicalName for the log group path', () => {
      const stack = makeStack()
      new EmLambdaFunction(stack, 'Subject', {
        ...defaultConfig(),
        physicalName: 'my-service-dev-my-handler'
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/my-service-dev-my-handler'
      })
    })
  })
})
