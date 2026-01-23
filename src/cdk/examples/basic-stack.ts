/**
 * Example: Basic CDK Stack with Lambda and DynamoDB
 */

import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import { EmLambdaFunction, EmDynamoDBTable } from '../constructs'

export class BasicExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stage = (process.env.STAGE || 'dev') as 'dev' | 'test' | 'staging' | 'prod'
    const serviceName = 'example-service'

    // Create DynamoDB table
    const table = new EmDynamoDBTable(this, 'DataTable', {
      stage,
      serviceName,
      tableName: 'data',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      }
    })

    // Create Lambda function
    const handler = new EmLambdaFunction(this, 'Handler', {
      stage,
      serviceName,
      functionName: 'handler',
      handler: 'index.handler',
      codePath: './dist',
      environment: {
        TABLE_NAME: table.getTableName()
      }
    })

    // Grant permissions
    table.grantReadWriteData(handler.getFunction())
  }
}
