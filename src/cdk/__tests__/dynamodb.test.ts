import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { EmDynamoDBTable } from '../constructs/dynamodb'

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

const baseConfig = {
  stage: 'dev' as const,
  serviceName: 'test-service',
  tableName: 'sessions',
  partitionKey: { name: 'pk', type: AttributeType.STRING }
}

describe('EmDynamoDBTable', () => {
  describe('synth', () => {
    it('synthesises without error', () => {
      const stack = makeStack()
      expect(() => new EmDynamoDBTable(stack, 'Subject', baseConfig)).not.toThrow()
    })
  })

  describe('table name', () => {
    it('generates table name as stage-serviceName-table-tableName', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', baseConfig)
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-test-service-table-sessions'
      })
    })
  })

  describe('defaults', () => {
    it('defaults to PAY_PER_REQUEST billing mode', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', baseConfig)
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST'
      })
    })

    it('uses AWS managed encryption', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', baseConfig)
      // CDK writes SSEEnabled:true but omits SSEType for AWS_MANAGED (CloudFormation default)
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        SSESpecification: { SSEEnabled: true }
      })
    })

    it('does not enable PITR on dev by default', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', baseConfig)
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false }
      })
    })

    it('enables PITR on prod by default', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', { ...baseConfig, stage: 'prod' })
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
      })
    })
  })

  describe('overrides', () => {
    it('respects custom billingMode', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', {
        ...baseConfig,
        billingMode: BillingMode.PROVISIONED
      })
      // PROVISIONED is the CloudFormation default — CDK omits BillingMode; check ProvisionedThroughput instead
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      })
    })

    it('respects explicit pointInTimeRecovery: true on dev', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', { ...baseConfig, pointInTimeRecovery: true })
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
      })
    })

    it('adds sort key when provided', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', {
        ...baseConfig,
        sortKey: { name: 'sk', type: AttributeType.STRING }
      })
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' }
        ]
      })
    })

    it('adds GSI when provided', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', {
        ...baseConfig,
        globalSecondaryIndexes: [
          {
            indexName: 'gsi1',
            partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }
          }
        ]
      })
      Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: [
          {
            IndexName: 'gsi1',
            KeySchema: [{ AttributeName: 'gsi1pk', KeyType: 'HASH' }]
          }
        ]
      })
    })
  })

  describe('removal policy', () => {
    it('retains table on prod', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', { ...baseConfig, stage: 'prod' })
      Template.fromStack(stack).hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain'
      })
    })

    it('destroys table on dev', () => {
      const stack = makeStack()
      new EmDynamoDBTable(stack, 'Subject', baseConfig)
      Template.fromStack(stack).hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete'
      })
    })
  })
})
