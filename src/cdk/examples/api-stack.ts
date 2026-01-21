/**
 * Example: API Gateway with multiple Lambda functions
 */

import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import {
  EmLambdaFunction,
  EmDynamoDBTable,
  EmRestApi
} from '../constructs'

export class ApiExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stage = (process.env.STAGE || 'dev') as 'dev' | 'test' | 'staging' | 'prod'
    const serviceName = 'contacts-api'

    // Create table
    const contactsTable = new EmDynamoDBTable(this, 'ContactsTable', {
      stage,
      serviceName,
      tableName: 'contacts',
      partitionKey: { name: 'id', type: AttributeType.STRING },
      sortKey: { name: 'createdAt', type: AttributeType.NUMBER }
    })

    // Create Lambda functions
    const getContacts = new EmLambdaFunction(this, 'GetContacts', {
      stage,
      serviceName,
      functionName: 'get-contacts',
      handler: 'handlers/getContacts.handler',
      codePath: './dist',
      environment: { TABLE_NAME: contactsTable.getTableName() }
    })

    const createContact = new EmLambdaFunction(this, 'CreateContact', {
      stage,
      serviceName,
      functionName: 'create-contact',
      handler: 'handlers/createContact.handler',
      codePath: './dist',
      environment: { TABLE_NAME: contactsTable.getTableName() }
    })

    // Grant permissions
    contactsTable.grantReadData(getContacts.getFunction())
    contactsTable.grantReadWriteData(createContact.getFunction())

    // Create API
    const api = new EmRestApi(this, 'ContactsApi', {
      stage,
      serviceName,
      apiName: 'contacts',
      defaultCorsOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    })

    // Add routes
    api.addLambdaIntegration('/contacts', 'GET', getContacts.getFunction())
    api.addLambdaIntegration('/contacts', 'POST', createContact.getFunction())
  }
}
