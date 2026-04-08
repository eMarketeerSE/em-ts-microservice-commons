import { App, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Function as LambdaFunction, Code, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { EmRestApi } from '../constructs/api-gateway'
import { EmHttpApi } from '../constructs/api-gateway'

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

function makeLambda(stack: Stack) {
  const role = new Role(stack, 'LambdaRole', {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com')
  })
  return new LambdaFunction(stack, 'Handler', {
    runtime: Runtime.NODEJS_22_X,
    handler: 'index.handler',
    code: Code.fromInline('exports.handler = async () => ({})'),
    role
  })
}

describe('EmRestApi', () => {
  const baseConfig = {
    stage: 'dev' as const,
    serviceName: 'test-service',
    apiName: 'my-api'
  }

  // CDK's RestApi requires at least one method before Template.fromStack() synthesises.
  // Each test that inspects the template must add a route first.
  function makeApiWithRoute(stack: Stack) {
    const api = new EmRestApi(stack, 'Subject', baseConfig)
    api.addLambdaIntegration('/ping', 'GET', makeLambda(stack))
    return api
  }

  describe('synth', () => {
    it('synthesises without error', () => {
      const stack = makeStack()
      const api = new EmRestApi(stack, 'Subject', baseConfig)
      api.addLambdaIntegration('/ping', 'GET', makeLambda(stack))
      expect(() => Template.fromStack(stack)).not.toThrow()
    })
  })

  describe('REST API', () => {
    it('creates one REST API', () => {
      const stack = makeStack()
      makeApiWithRoute(stack)
      Template.fromStack(stack).resourceCountIs('AWS::ApiGateway::RestApi', 1)
    })

    it('generates API name as stage-serviceName-api-apiName', () => {
      const stack = makeStack()
      makeApiWithRoute(stack)
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'dev-test-service-api-my-api'
      })
    })

    it('defaults dataTraceEnabled to false', () => {
      const stack = makeStack()
      makeApiWithRoute(stack)
      // dataTraceEnabled is surfaced inside MethodSettings, not as a top-level Stage property
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([Match.objectLike({ DataTraceEnabled: false })])
      })
    })

    it('defaults metricsEnabled to true', () => {
      const stack = makeStack()
      makeApiWithRoute(stack)
      // metricsEnabled is surfaced inside MethodSettings, not as a top-level Stage property
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([Match.objectLike({ MetricsEnabled: true })])
      })
    })

    it('defaults throttlingRateLimit to 10000', () => {
      const stack = makeStack()
      makeApiWithRoute(stack)
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: [{ ThrottlingRateLimit: 10000 }]
      })
    })

    it('defaults throttlingBurstLimit to 5000', () => {
      const stack = makeStack()
      makeApiWithRoute(stack)
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: [{ ThrottlingBurstLimit: 5000 }]
      })
    })
  })

  describe('addLambdaIntegration', () => {
    it('throws on unknown HTTP method', () => {
      const stack = makeStack()
      const api = new EmRestApi(stack, 'Subject', baseConfig)
      const handler = makeLambda(stack)
      // CDK's addMethod throws its own validation error for invalid methods
      expect(() => api.addLambdaIntegration('/items', 'INVALID', handler)).toThrow()
    })

    it('adds a resource and method for a valid route', () => {
      const stack = makeStack()
      const api = new EmRestApi(stack, 'Subject', baseConfig)
      const handler = makeLambda(stack)
      api.addLambdaIntegration('/items', 'GET', handler)
      Template.fromStack(stack).resourceCountIs('AWS::ApiGateway::Method', 1)
    })
  })

  describe('addBasePathMapping', () => {
    it('creates a CfnBasePathMapping resource', () => {
      const stack = makeStack()
      const api = makeApiWithRoute(stack)
      api.addBasePathMapping('api.example.com')

      Template.fromStack(stack).resourceCountIs('AWS::ApiGateway::BasePathMapping', 1)
    })

    it('sets the domain name on the mapping', () => {
      const stack = makeStack()
      const api = makeApiWithRoute(stack)
      api.addBasePathMapping('api.example.com')

      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::BasePathMapping', {
        DomainName: 'api.example.com'
      })
    })

    it('sets basePath when provided', () => {
      const stack = makeStack()
      const api = makeApiWithRoute(stack)
      api.addBasePathMapping('api.example.com', { basePath: 'screenshots' })

      Template.fromStack(stack).hasResourceProperties('AWS::ApiGateway::BasePathMapping', {
        DomainName: 'api.example.com',
        BasePath: 'screenshots'
      })
    })

    it('overrides logical ID when logicalId is provided', () => {
      const stack = makeStack()
      const api = makeApiWithRoute(stack)
      api.addBasePathMapping('api.example.com', {
        basePath: 'screenshots',
        logicalId: 'ScreenshotBasePathMapping'
      })

      const template = Template.fromStack(stack)
      const mappings = template.findResources('AWS::ApiGateway::BasePathMapping')
      expect(mappings).toHaveProperty('ScreenshotBasePathMapping')
    })
  })
})

describe('EmHttpApi', () => {
  const baseConfig = {
    stage: 'dev' as const,
    serviceName: 'test-service',
    apiName: 'my-api'
  }

  describe('synth', () => {
    it('synthesises without error', () => {
      const stack = makeStack()
      expect(() => new EmHttpApi(stack, 'Subject', baseConfig)).not.toThrow()
    })
  })

  describe('HTTP API', () => {
    it('creates one HTTP API', () => {
      const stack = makeStack()
      new EmHttpApi(stack, 'Subject', baseConfig)
      Template.fromStack(stack).resourceCountIs('AWS::ApiGatewayV2::Api', 1)
    })

    it('generates API name as stage-serviceName-api-apiName', () => {
      const stack = makeStack()
      new EmHttpApi(stack, 'Subject', baseConfig)
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Api', {
        Name: 'dev-test-service-api-my-api'
      })
    })

    it('creates a default stage with autoDeploy', () => {
      const stack = makeStack()
      new EmHttpApi(stack, 'Subject', baseConfig)
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
        StageName: '$default',
        AutoDeploy: true
      })
    })

    it('applies throttle when provided', () => {
      const stack = makeStack()
      new EmHttpApi(stack, 'Subject', {
        ...baseConfig,
        throttle: { rateLimit: 1000, burstLimit: 500 }
      })
      Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
        DefaultRouteSettings: {
          ThrottlingRateLimit: 1000,
          ThrottlingBurstLimit: 500
        }
      })
    })
  })

  describe('addLambdaIntegration', () => {
    it('throws on unknown HTTP method', () => {
      const stack = makeStack()
      const api = new EmHttpApi(stack, 'Subject', baseConfig)
      const handler = makeLambda(stack)
      expect(() => api.addLambdaIntegration('/items', 'INVALID', handler)).toThrow(
        'Unknown HTTP method'
      )
    })

    it('adds a route for a valid method', () => {
      const stack = makeStack()
      const api = new EmHttpApi(stack, 'Subject', baseConfig)
      const handler = makeLambda(stack)
      api.addLambdaIntegration('/items', 'GET', handler)
      Template.fromStack(stack).resourceCountIs('AWS::ApiGatewayV2::Route', 1)
    })
  })
})
