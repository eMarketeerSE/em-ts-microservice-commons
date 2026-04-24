import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Code, Runtime, LayerVersion, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import {
  toServerlessLogicalIdPrefix,
  overrideLayerLogicalId,
  overrideRoleLogicalId,
  overrideFunctionLogicalIds,
  createServerlessCompatibleOutput,
  makeServerlessQueue,
  makeSnsToSqsSubscription,
  makeSnsToLambdaSubscription,
  makeServerlessQueuePolicy,
  makeServerlessDynamoTable
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

  it('overrides RoleName to prevent role replacement on migration', () => {
    const stack = makeStack()
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    })

    overrideRoleLogicalId(role, 'IamRoleLambdaExecution', {
      roleName: 'my-service-dev-eu-west-1-lambdaRole'
    })

    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'my-service-dev-eu-west-1-lambdaRole'
    })
  })

  it('strips Path to prevent role replacement when Serverless never emitted it', () => {
    const stack = makeStack()
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    })

    overrideRoleLogicalId(role, 'IamRoleLambdaExecution', { deletePath: true })

    const template = Template.fromStack(stack)
    const roles = template.findResources('AWS::IAM::Role')
    expect(roles.IamRoleLambdaExecution.Properties).not.toHaveProperty('Path')
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

describe('makeServerlessQueue', () => {
  it('creates queue and DLQ with specified logical IDs', () => {
    const stack = makeStack()

    makeServerlessQueue(
      stack,
      'MqlEventsQueue',
      'MqlEventsQueueDLQ',
      'dev-em-contacts-service-mql-event-queue',
      'dev-em-contacts-service-mql-event-queue-dlq',
      'dev'
    )

    const template = Template.fromStack(stack)
    const queues = template.findResources('AWS::SQS::Queue')
    expect(queues).toHaveProperty('MqlEventsQueue')
    expect(queues).toHaveProperty('MqlEventsQueueDLQ')
  })

  it('sets DLQ retention to 14 days', () => {
    const stack = makeStack()
    makeServerlessQueue(stack, 'Q', 'QDLQ', 'q', 'qdlq', 'dev')
    const template = Template.fromStack(stack)
    const queues = template.findResources('AWS::SQS::Queue')
    expect(queues.QDLQ.Properties.MessageRetentionPeriod).toBe(14 * 24 * 60 * 60)
  })

  it('sets default visibility timeout to 900 seconds', () => {
    const stack = makeStack()
    makeServerlessQueue(stack, 'Q', 'QDLQ', 'q', 'qdlq', 'dev')
    const template = Template.fromStack(stack)
    const queues = template.findResources('AWS::SQS::Queue')
    expect(queues.Q.Properties.VisibilityTimeout).toBe(900)
  })

  it('creates DlqAlarm when alarm opt provided', () => {
    const stack = makeStack()
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    makeServerlessQueue(stack, 'Q', 'QDLQ', 'q', 'qdlq', 'dev', {
      alarm: { name: 'QDLQAlarm', topic: alarmTopic }
    })

    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'QDLQAlarm'
    })
  })

  it('overrides alarm logical ID when opts.alarm.logicalId is provided', () => {
    const stack = makeStack()
    const alarmTopic = new Topic(stack, 'AlarmTopic')

    makeServerlessQueue(stack, 'Q', 'QDLQ', 'q', 'qdlq', 'dev', {
      alarm: { name: 'QDLQAlarm', topic: alarmTopic, logicalId: 'MyCustomAlarmId' }
    })

    const template = Template.fromStack(stack)
    expect(template.findResources('AWS::CloudWatch::Alarm')).toHaveProperty('MyCustomAlarmId')
  })

  it('does not create DlqAlarm when alarm opt omitted', () => {
    const stack = makeStack()
    makeServerlessQueue(stack, 'Q', 'QDLQ', 'q', 'qdlq', 'dev')
    const template = Template.fromStack(stack)
    expect(template.findResources('AWS::CloudWatch::Alarm')).toEqual({})
  })

  it('wires main queue to DLQ with default maxReceiveCount of 3', () => {
    const stack = makeStack()
    makeServerlessQueue(stack, 'MqlEventsQueue', 'MqlEventsQueueDLQ', 'q', 'qdlq', 'dev')
    const template = Template.fromStack(stack)
    const queues = template.findResources('AWS::SQS::Queue')
    const redrive = queues.MqlEventsQueue.Properties.RedrivePolicy
    expect(redrive.maxReceiveCount).toBe(3)
    expect(redrive.deadLetterTargetArn).toMatchObject({
      'Fn::GetAtt': ['MqlEventsQueueDLQ', 'Arn']
    })
  })

  it('applies RETAIN removal policy for prod', () => {
    const stack = makeStack()
    makeServerlessQueue(stack, 'Q', 'QDLQ', 'q', 'qdlq', 'prod')
    const template = Template.fromStack(stack)
    const queues = template.findResources('AWS::SQS::Queue')
    Object.values(queues).forEach(q => {
      expect((q as { DeletionPolicy?: string }).DeletionPolicy).toBe('Retain')
    })
  })
})

describe('makeSnsToSqsSubscription', () => {
  it('creates subscription with specified logical ID and properties', () => {
    const stack = makeStack()

    makeSnsToSqsSubscription(stack, 'TenantPurgeSubscription', {
      topicArn: 'arn:aws:sns:eu-west-1:123456789012:dev-emarketeer-event-purge-tenant-data',
      endpoint: 'arn:aws:sqs:eu-west-1:123456789012:dev-em-contacts-service-tenant-purge',
      protocol: 'sqs',
      rawMessageDelivery: true
    })

    const template = Template.fromStack(stack)
    const subs = template.findResources('AWS::SNS::Subscription')
    expect(subs).toHaveProperty('TenantPurgeSubscription')
    expect(subs.TenantPurgeSubscription.Properties.Protocol).toBe('sqs')
    expect(subs.TenantPurgeSubscription.Properties.RawMessageDelivery).toBe(true)
  })
})

describe('makeServerlessQueuePolicy', () => {
  it('creates queue policy with specified logical ID', () => {
    const stack = makeStack()

    makeServerlessQueuePolicy(stack, 'MqlEventSQSPolicy', {
      queues: ['https://sqs.eu-west-1.amazonaws.com/123456789012/dev-mql-event-queue'],
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: '*', Action: 'sqs:SendMessage', Resource: '*' }]
      }
    })

    const template = Template.fromStack(stack)
    const policies = template.findResources('AWS::SQS::QueuePolicy')
    expect(policies).toHaveProperty('MqlEventSQSPolicy')
    expect(policies.MqlEventSQSPolicy.Properties.PolicyDocument.Statement[0].Effect).toBe('Allow')
    expect(policies.MqlEventSQSPolicy.Properties.PolicyDocument.Statement[0].Action).toBe(
      'sqs:SendMessage'
    )
  })
})

describe('overrideFunctionLogicalIds', () => {
  it('sets function and log group logical IDs with Serverless naming convention', () => {
    const stack = makeStack()
    const fn = new LambdaFunction(stack, 'TestFn', {
      code: Code.fromInline('exports.handler = async () => {}'),
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      logGroup: new LogGroup(stack, 'TestLogGroup')
    })

    overrideFunctionLogicalIds(fn, 'my-handler')

    const template = Template.fromStack(stack)
    expect(template.findResources('AWS::Lambda::Function')).toHaveProperty(
      'MyDashhandlerLambdaFunction'
    )
    const logGroups = template.findResources('AWS::Logs::LogGroup')
    expect(logGroups).toHaveProperty('MyDashhandlerLogGroup')
  })

  it('applies RETAIN removal policy to the log group', () => {
    const stack = makeStack()
    const fn = new LambdaFunction(stack, 'TestFn', {
      code: Code.fromInline('exports.handler = async () => {}'),
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      logGroup: new LogGroup(stack, 'TestLogGroup')
    })

    overrideFunctionLogicalIds(fn, 'my-handler')

    const template = Template.fromStack(stack)
    const logGroups = template.findResources('AWS::Logs::LogGroup')
    expect(logGroups.MyDashhandlerLogGroup.DeletionPolicy).toBe('Retain')
  })
})

describe('makeSnsToLambdaSubscription', () => {
  it('creates subscription with lambda protocol and overridden logical ID', () => {
    const stack = makeStack()

    makeSnsToLambdaSubscription(
      stack,
      'HandleEmailStatusSnsSubscription',
      'HandleEmailStatusLambdaPermission',
      {
        topicArn: 'arn:aws:sns:eu-west-1:123456789012:dev-emarketeer-event-email-status',
        functionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:my-service-dev-handler'
      }
    )

    const template = Template.fromStack(stack)
    const subs = template.findResources('AWS::SNS::Subscription')
    expect(subs).toHaveProperty('HandleEmailStatusSnsSubscription')
    expect(subs.HandleEmailStatusSnsSubscription.Properties.Protocol).toBe('lambda')
    const perms = template.findResources('AWS::Lambda::Permission')
    expect(perms).toHaveProperty('HandleEmailStatusLambdaPermission')
    expect(perms.HandleEmailStatusLambdaPermission.Properties.Action).toBe('lambda:InvokeFunction')
  })

  it('throws when topicArn is a CDK token', () => {
    const stack = makeStack()
    const topic = new Topic(stack, 'TestTopic')

    expect(() =>
      makeSnsToLambdaSubscription(stack, 'SubId', 'PermId', {
        topicArn: topic.topicArn,
        functionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:my-service-dev-handler'
      })
    ).toThrow('makeSnsToLambdaSubscription requires literal ARN strings, not CDK tokens')
  })

  it('throws when functionArn is a CDK token', () => {
    const stack = makeStack()
    const fn = new LambdaFunction(stack, 'TestFn', {
      code: Code.fromInline('exports.handler = async () => {}'),
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler'
    })

    expect(() =>
      makeSnsToLambdaSubscription(stack, 'SubId', 'PermId', {
        topicArn: 'arn:aws:sns:eu-west-1:123456789012:dev-my-topic',
        functionArn: fn.functionArn
      })
    ).toThrow('makeSnsToLambdaSubscription requires literal ARN strings, not CDK tokens')
  })
})

describe('makeServerlessDynamoTable', () => {
  it('overrides logical ID and uses PAY_PER_REQUEST billing', () => {
    const stack = makeStack()

    makeServerlessDynamoTable(stack, 'LeadCountTable', 'dev-em-contacts-service-lead-count', 'dev', {
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })

    const template = Template.fromStack(stack)
    expect(template.findResources('AWS::DynamoDB::Table')).toHaveProperty('LeadCountTable')
    template.hasResourceProperties('AWS::DynamoDB::Table', { BillingMode: 'PAY_PER_REQUEST' })
  })

  it('disables PITR in non-prod stages', () => {
    const stack = makeStack()
    makeServerlessDynamoTable(stack, 'T', 'dev-table', 'dev', {
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })
    Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false }
    })
  })

  it('enables PITR in prod', () => {
    const stack = makeStack()
    makeServerlessDynamoTable(stack, 'T', 'prod-table', 'prod', {
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })
    Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
    })
  })
})

describe('negative paths — imported resources throw loudly', () => {
  it('overrideLayerLogicalId throws on imported layer', () => {
    const stack = makeStack()
    const imported = LayerVersion.fromLayerVersionArn(
      stack,
      'ImportedLayer',
      'arn:aws:lambda:eu-west-1:123456789012:layer:my-layer:1'
    )
    expect(() => overrideLayerLogicalId(imported, 'SomeId')).toThrow()
  })

  it('overrideRoleLogicalId throws on imported role', () => {
    const stack = makeStack()
    const imported = Role.fromRoleArn(
      stack,
      'ImportedRole',
      'arn:aws:iam::123456789012:role/my-role'
    )
    expect(() => overrideRoleLogicalId(imported as any)).toThrow()
  })

  it('overrideFunctionLogicalIds throws on imported function', () => {
    const stack = makeStack()
    const imported = LambdaFunction.fromFunctionArn(
      stack,
      'ImportedFn',
      'arn:aws:lambda:eu-west-1:123456789012:function:my-fn'
    ) as unknown as LambdaFunction
    expect(() => overrideFunctionLogicalIds(imported, 'my-fn')).toThrow()
  })
})
