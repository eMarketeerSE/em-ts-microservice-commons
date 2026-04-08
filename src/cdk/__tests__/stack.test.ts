import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
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

    it('throws when neither handlerPath nor required fields are provided', () => {
      const stack = makeStack()
      expect(() => {
        stack.createFunction('Handler', {} as any)
      }).toThrow(
        'createFunction() requires either `handlerPath` or all of `functionName`, `handler`, and `codePath`.'
      )
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
})
