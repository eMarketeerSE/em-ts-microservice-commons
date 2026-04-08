import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Code, Runtime, LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import {
  toServerlessLogicalIdPrefix,
  overrideLayerLogicalId,
  overrideRoleLogicalId,
  createServerlessCompatibleOutput
} from '../utils/serverless-migration'

const CODE_PATH = __dirname

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

describe('toServerlessLogicalIdPrefix', () => {
  it('converts hyphenated function names', () => {
    expect(toServerlessLogicalIdPrefix('capture-screenshot-from-url')).toBe(
      'CaptureDashscreenshotDashfromDashurl'
    )
  })

  it('handles single-word names', () => {
    expect(toServerlessLogicalIdPrefix('handler')).toBe('Handler')
  })

  it('handles underscored names', () => {
    expect(toServerlessLogicalIdPrefix('my_function')).toBe('MyUnderscorefunction')
  })

  it('handles mixed hyphens and underscores', () => {
    expect(toServerlessLogicalIdPrefix('get-user_profile')).toBe('GetDashuserUnderscoreprofile')
  })
})

describe('overrideLayerLogicalId', () => {
  it('sets layer logical ID', () => {
    const stack = makeStack()
    const layer = new LayerVersion(stack, 'TestLayer', {
      code: Code.fromAsset(CODE_PATH),
      compatibleRuntimes: [Runtime.NODEJS_20_X]
    })

    overrideLayerLogicalId(layer, 'ChromiumLayerLambdaLayer')

    const template = Template.fromStack(stack)
    const layers = template.findResources('AWS::Lambda::LayerVersion')
    expect(layers).toHaveProperty('ChromiumLayerLambdaLayer')
  })
})

describe('overrideRoleLogicalId', () => {
  it('defaults to IamRoleLambdaExecution', () => {
    const stack = makeStack()
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    })

    overrideRoleLogicalId(role)

    const template = Template.fromStack(stack)
    const roles = template.findResources('AWS::IAM::Role')
    expect(roles).toHaveProperty('IamRoleLambdaExecution')
  })

  it('accepts a custom logical ID', () => {
    const stack = makeStack()
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    })

    overrideRoleLogicalId(role, 'MyCustomRoleId')

    const template = Template.fromStack(stack)
    const roles = template.findResources('AWS::IAM::Role')
    expect(roles).toHaveProperty('MyCustomRoleId')
  })
})

describe('createServerlessCompatibleOutput', () => {
  it('creates output with sls-{service}-{stage}-{key} export name', () => {
    const stack = makeStack()

    createServerlessCompatibleOutput(stack, 'ServiceEndpoint', {
      serviceName: 'screenshot-service',
      stage: 'dev',
      outputKey: 'ServiceEndpoint',
      value: 'https://example.com',
      description: 'URL of the service endpoint'
    })

    const template = Template.fromStack(stack)
    const outputs = template.toJSON().Outputs
    const output = Object.values(
      outputs as Record<string, { Export: { Name: string }; Value: string; Description: string }>
    )[0]
    expect(output.Export.Name).toBe('sls-screenshot-service-dev-ServiceEndpoint')
    expect(output.Value).toBe('https://example.com')
    expect(output.Description).toBe('URL of the service endpoint')
  })
})
