# eMarketeer CDK Commons Library

A comprehensive collection of AWS CDK v2 constructs and utilities for eMarketeer microservices.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Constructs](#constructs)
- [Utilities](#utilities)
- [Best Practices](#best-practices)
- [Migration from Serverless Framework](#migration-from-serverless-framework)

## Overview

This library provides standardized, reusable CDK constructs and utilities that follow eMarketeer's infrastructure patterns and best practices. It includes support for:

- Lambda functions with standard configurations
- DynamoDB tables with single-table design helpers
- API Gateway (REST and HTTP APIs)
- SQS queues with DLQ configurations
- SNS topics
- EventBridge rules
- IAM roles and policies
- CloudWatch log groups
- Environment-specific configurations
- Stack naming conventions and tagging strategies

## Installation

The CDK commons are part of the `@emarketeer/ts-microservice-commons` package.

```bash
npm install @emarketeer/ts-microservice-commons
# or
yarn add @emarketeer/ts-microservice-commons
```

### CDK Dependencies

Add these peer dependencies to your project:

```bash
npm install aws-cdk-lib@^2.0.0 constructs@^10.0.0
# or
yarn add aws-cdk-lib@^2.0.0 constructs@^10.0.0
```

## Quick Start

```typescript
import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { 
  EmLambdaFunction,
  EmDynamoDBTable,
  EmRestApi 
} from '@emarketeer/ts-microservice-commons/cdk'

export class MyServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stage = process.env.STAGE as 'dev' | 'test' | 'staging' | 'prod'

    // Create a Lambda function
    const myFunction = new EmLambdaFunction(this, 'MyFunction', {
      stage,
      serviceName: 'my-service',
      functionName: 'handler',
      handler: 'index.handler',
      codePath: './dist'
    })

    // Create a DynamoDB table
    const myTable = new EmDynamoDBTable(this, 'MyTable', {
      stage,
      serviceName: 'my-service',
      tableName: 'data',
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })

    // Grant permissions
    myTable.grantReadWriteData(myFunction.getFunction())
  }
}
```

## Constructs

### Lambda Functions

Create Lambda functions with standardized eMarketeer configurations.

```typescript
import { EmLambdaFunction } from '@emarketeer/ts-microservice-commons/cdk'
import { Duration } from 'aws-cdk-lib'

const lambda = new EmLambdaFunction(this, 'MyFunction', {
  stage: 'dev',
  serviceName: 'contacts',
  functionName: 'get-contact',
  handler: 'handlers/getContact.handler',
  codePath: './dist',
  memorySize: 1024,
  timeout: Duration.seconds(30),
  environment: {
    TABLE_NAME: myTable.getTableName()
  }
})
```

**Default configurations:**
- Runtime: Node.js 22.x
- Architecture: ARM64
- Memory: 1024 MB
- Timeout: 15 seconds
- Retry attempts: 2

### DynamoDB Tables

Create DynamoDB tables with support for single-table design patterns.

```typescript
import { EmDynamoDBTable, createSingleTable, GSI_PATTERNS } from '@emarketeer/ts-microservice-commons/cdk'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'

// Single-table design
const table = createSingleTable(this, 'DataTable', {
  stage: 'dev',
  serviceName: 'contacts',
  tableName: 'contacts',
  globalSecondaryIndexes: [
    GSI_PATTERNS.singleTableGSI('GSI1'),
    GSI_PATTERNS.byStatusAndTimestamp()
  ]
})

// Traditional table
const userTable = new EmDynamoDBTable(this, 'UserTable', {
  stage: 'dev',
  serviceName: 'contacts',
  tableName: 'users',
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.NUMBER },
  stream: true,
  pointInTimeRecovery: true
})
```

### API Gateway

Create REST API or HTTP API with CORS and logging.

```typescript
import { EmRestApi, EmHttpApi } from '@emarketeer/ts-microservice-commons/cdk'

// REST API
const restApi = new EmRestApi(this, 'ContactsApi', {
  stage: 'dev',
  serviceName: 'contacts',
  apiName: 'main',
  defaultCorsOptions: {
    allowOrigins: ['*'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization']
  }
})

restApi.addLambdaIntegration('/contacts', 'GET', getContactsLambda.getFunction())

// HTTP API (faster and cheaper)
const httpApi = new EmHttpApi(this, 'ContactsHttpApi', {
  stage: 'dev',
  serviceName: 'contacts',
  apiName: 'main'
})

httpApi.addLambdaIntegration('/contacts', 'GET', getContactsLambda.getFunction())
```

### SQS Queues

Create SQS queues with DLQ support.

```typescript
import { EmSqsQueue, createQueueWithDLQ } from '@emarketeer/ts-microservice-commons/cdk'
import { Duration } from 'aws-cdk-lib'

// Queue with DLQ
const queue = createQueueWithDLQ(this, 'ProcessQueue', {
  stage: 'dev',
  serviceName: 'contacts',
  queueName: 'process',
  visibilityTimeout: Duration.seconds(300),
  maxReceiveCount: 3
})

// FIFO queue
const fifoQueue = new EmSqsQueue(this, 'OrderQueue', {
  stage: 'dev',
  serviceName: 'orders',
  queueName: 'orders',
  fifo: true,
  contentBasedDeduplication: true
})
```

### SNS Topics

Create SNS topics with subscriptions.

```typescript
import { EmSnsTopic } from '@emarketeer/ts-microservice-commons/cdk'

const topic = new EmSnsTopic(this, 'ContactTopic', {
  stage: 'dev',
  serviceName: 'contacts',
  topicName: 'contact-events',
  displayName: 'Contact Events'
})

// Add subscriptions
topic.addLambdaSubscription(processorLambda.getFunction())
topic.addSqsSubscription(queue.getQueue())
topic.addEmailSubscription('alerts@emarketeer.com')
```

### EventBridge Rules

Create EventBridge rules for scheduled or event-driven processing.

```typescript
import { EmEventBridgeRule, EVENT_PATTERNS } from '@emarketeer/ts-microservice-commons/cdk'

// Scheduled rule
const scheduledRule = new EmEventBridgeRule(this, 'DailySync', {
  stage: 'dev',
  serviceName: 'contacts',
  ruleName: 'daily-sync',
  schedule: 'rate(1 day)'
})
scheduledRule.addLambdaTarget(syncLambda.getFunction())

// Event pattern rule
const eventRule = new EmEventBridgeRule(this, 'S3Upload', {
  stage: 'dev',
  serviceName: 'contacts',
  ruleName: 's3-upload',
  eventPattern: EVENT_PATTERNS.s3ObjectCreated('my-bucket')
})
eventRule.addLambdaTarget(processLambda.getFunction())
```

## Utilities

### Naming Conventions

```typescript
import { 
  generateLambdaName,
  generateTableName,
  generateQueueName 
} from '@emarketeer/ts-microservice-commons/cdk'

const lambdaName = generateLambdaName('dev', 'contacts', 'get-contact')
// Result: dev-contacts-lambda-get-contact

const tableName = generateTableName('prod', 'contacts', 'data')
// Result: prod-contacts-table-data
```

### Tagging Strategies

```typescript
import { applyStandardTags } from '@emarketeer/ts-microservice-commons/cdk'

applyStandardTags(myConstruct, {
  stage: 'dev',
  serviceName: 'contacts',
  owner: 'platform-team',
  costCenter: 'engineering',
  customTags: {
    project: 'crm-migration'
  }
})
```

### Environment Configuration

```typescript
import { 
  getEnvironmentConfig,
  getLambdaEnvironmentVariables,
  getResourceLimits 
} from '@emarketeer/ts-microservice-commons/cdk'

const config = getEnvironmentConfig('dev', {
  account: '123456789012',
  region: 'eu-west-1'
})

const lambdaEnv = getLambdaEnvironmentVariables('dev', {
  TABLE_NAME: table.getTableName(),
  API_KEY: process.env.API_KEY
})

const limits = getResourceLimits('prod')
// { lambdaMemory: 1024, lambdaTimeout: 30, ... }
```

### IAM Helpers

```typescript
import { 
  createDynamoDBAccessPolicy,
  createSQSAccessPolicy,
  createS3ReadPolicy 
} from '@emarketeer/ts-microservice-commons/cdk'

// Add policies to Lambda role
const lambda = new EmLambdaFunction(this, 'MyFunction', { ... })
lambda.getFunction().addToRolePolicy(
  createDynamoDBAccessPolicy(table.getTableArn())
)
lambda.getFunction().addToRolePolicy(
  createSQSAccessPolicy(queue.getQueueArn())
)
```

## Best Practices

### 1. Use Environment Variables

Always use environment variables for stage and configuration:

```typescript
const stage = process.env.STAGE || 'dev'
const region = process.env.AWS_REGION || 'eu-west-1'
```

### 2. Follow Naming Conventions

Use the provided naming utilities to ensure consistency:

```typescript
// Good
const name = generateLambdaName(stage, serviceName, functionName)

// Avoid
const name = `${stage}-${serviceName}-${functionName}`
```

### 3. Apply Standard Tags

Always apply tags to resources for cost allocation and management:

```typescript
applyStandardTags(resource, {
  stage,
  serviceName,
  owner: 'team-name',
  costCenter: 'engineering'
})
```

### 4. Use Helper Functions

Leverage helper functions for common patterns:

```typescript
// Single-table design
const table = createSingleTable(this, 'Data', { ... })

// Queue with DLQ
const queue = createQueueWithDLQ(this, 'Process', { ... })
```

### 5. Environment-Specific Configuration

Use stage-specific configurations:

```typescript
const limits = getResourceLimits(stage)

const lambda = new EmLambdaFunction(this, 'Function', {
  memorySize: limits.lambdaMemory,
  timeout: Duration.seconds(limits.lambdaTimeout),
  ...
})
```

### 6. Grant Permissions Explicitly

Always grant minimal required permissions:

```typescript
table.grantReadData(lambda.getFunction())
// Instead of grantReadWriteData if only read is needed
```

## Migration from Serverless Framework

### Comparison Table

| Serverless Framework | CDK v2 |
|---------------------|--------|
| `serverless.yml` | TypeScript Stack |
| `functions:` | `EmLambdaFunction` |
| `resources:` | CDK Constructs |
| `custom:` | Environment Config |
| `provider.iamRoleStatements:` | IAM Policies |

### Example Migration

**Before (Serverless Framework):**

```yaml
functions:
  getContact:
    handler: handlers/getContact.handler
    memorySize: 1024
    timeout: 30
    environment:
      TABLE_NAME: ${self:custom.tableName}
    events:
      - http:
          path: /contacts/{id}
          method: GET

resources:
  Resources:
    ContactsTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:custom.tableName}
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        BillingMode: PAY_PER_REQUEST
```

**After (CDK v2):**

```typescript
import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import {
  EmLambdaFunction,
  EmDynamoDBTable,
  EmRestApi
} from '@emarketeer/ts-microservice-commons/cdk'

export class ContactsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stage = process.env.STAGE as any

    // Create table
    const table = new EmDynamoDBTable(this, 'ContactsTable', {
      stage,
      serviceName: 'contacts',
      tableName: 'contacts',
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })

    // Create Lambda
    const getContact = new EmLambdaFunction(this, 'GetContact', {
      stage,
      serviceName: 'contacts',
      functionName: 'get-contact',
      handler: 'handlers/getContact.handler',
      codePath: './dist',
      memorySize: 1024,
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME: table.getTableName()
      }
    })

    // Grant permissions
    table.grantReadData(getContact.getFunction())

    // Create API
    const api = new EmRestApi(this, 'Api', {
      stage,
      serviceName: 'contacts',
      apiName: 'main'
    })

    api.addLambdaIntegration('/contacts/{id}', 'GET', getContact.getFunction())
  }
}
```

### Migration Steps

1. **Install CDK dependencies:**
   ```bash
   npm install aws-cdk-lib@^2.0.0 constructs@^10.0.0
   ```

2. **Create CDK app structure:**
   ```
   cdk/
   ├── bin/
   │   └── app.ts
   ├── lib/
   │   └── stack.ts
   ├── cdk.json
   └── tsconfig.json
   ```

3. **Convert resources:** Use the constructs from this library to replace CloudFormation resources.

4. **Deploy:**
   ```bash
   cdk deploy --profile your-profile
   ```

### Key Differences

1. **Type Safety:** CDK provides full TypeScript type checking
2. **Reusability:** Create custom constructs and share them
3. **Testing:** Write unit tests for infrastructure code
4. **IDE Support:** IntelliSense and auto-completion
5. **Logical Programming:** Use loops, conditions, and functions

### Common Patterns

#### Pattern 1: Multiple Lambda Functions

```typescript
const handlers = ['getContact', 'createContact', 'updateContact', 'deleteContact']

handlers.forEach(handlerName => {
  const lambda = new EmLambdaFunction(this, handlerName, {
    stage,
    serviceName: 'contacts',
    functionName: handlerName,
    handler: `handlers/${handlerName}.handler`,
    codePath: './dist',
    environment: { TABLE_NAME: table.getTableName() }
  })
  
  table.grantReadWriteData(lambda.getFunction())
  api.addLambdaIntegration(`/contacts`, handlerName.includes('get') ? 'GET' : 'POST', lambda.getFunction())
})
```

#### Pattern 2: Cross-Stack References

```typescript
// Stack 1: Database Stack
export class DatabaseStack extends Stack {
  public readonly table: EmDynamoDBTable

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    
    this.table = new EmDynamoDBTable(this, 'Table', { ... })
  }
}

// Stack 2: API Stack
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, table: EmDynamoDBTable, props?: StackProps) {
    super(scope, id, props)
    
    const lambda = new EmLambdaFunction(this, 'Handler', {
      environment: { TABLE_NAME: table.getTableName() }
    })
    
    table.grantReadData(lambda.getFunction())
  }
}
```

## Additional Resources

- [AWS CDK v2 Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [eMarketeer Platform Documentation](https://wiki.emarketeer.com)

