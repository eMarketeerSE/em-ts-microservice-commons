# Getting Started with eMarketeer CDK Commons

This guide will help you start using the CDK commons library in your microservice.

## Prerequisites

- Node.js 22.x or later
- AWS CDK CLI installed: `npm install -g aws-cdk`
- Basic understanding of AWS CDK concepts

## Step 1: Install Dependencies

In your microservice project:

```bash
# Install the commons library
yarn add @emarketeer/ts-microservice-commons

# Install CDK peer dependencies
yarn add aws-cdk-lib@^2.0.0 constructs@^10.0.0

# Install CDK CLI if not already installed
npm install -g aws-cdk
```

## Step 2: Create CDK Project Structure

Create the following structure in your project:

```
your-service/
├── cdk/
│   ├── bin/
│   │   └── app.ts          # CDK app entry point
│   ├── lib/
│   │   └── stack.ts        # Your stack definition
│   ├── cdk.json            # CDK configuration
│   └── tsconfig.json       # TypeScript config for CDK
├── src/                    # Your Lambda code
│   └── handlers/
└── package.json
```

## Step 3: Create cdk.json

```json
{
  "app": "ts-node cdk/bin/app.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules"
    ]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"]
  }
}
```

## Step 4: Create CDK App Entry Point

`cdk/bin/app.ts`:

```typescript
#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { MyServiceStack } from '../lib/stack'

const app = new cdk.App()

const stage = process.env.STAGE || 'dev'
const region = process.env.AWS_REGION || 'eu-west-1'

new MyServiceStack(app, `${stage}-my-service-stack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region
  },
  stackName: `${stage}-my-service-stack`,
  description: 'My Service Infrastructure'
})

app.synth()
```

## Step 5: Create Your Stack

`cdk/lib/stack.ts`:

```typescript
import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import {
  EmLambdaFunction,
  EmDynamoDBTable,
  EmRestApi,
  applyStandardTags
} from '@emarketeer/ts-microservice-commons/cdk'

export class MyServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const stage = (process.env.STAGE || 'dev') as 'dev' | 'test' | 'staging' | 'prod'
    const serviceName = 'my-service'

    // Apply tags to the entire stack
    applyStandardTags(this, {
      stage,
      serviceName,
      owner: 'platform-team'
    })

    // Create DynamoDB table
    const table = new EmDynamoDBTable(this, 'DataTable', {
      stage,
      serviceName,
      tableName: 'data',
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })

    // Create Lambda function
    const getHandler = new EmLambdaFunction(this, 'GetHandler', {
      stage,
      serviceName,
      functionName: 'get-data',
      handler: 'handlers/getData.handler',
      codePath: './dist',
      environment: {
        TABLE_NAME: table.getTableName()
      }
    })

    // Grant permissions
    table.grantReadData(getHandler.getFunction())

    // Create API
    const api = new EmRestApi(this, 'Api', {
      stage,
      serviceName,
      apiName: 'main',
      defaultCorsOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST']
      }
    })

    // Add route
    api.addLambdaIntegration('/data/{id}', 'GET', getHandler.getFunction())
  }
}
```

## Step 6: Build Your Lambda Code

Ensure your Lambda code is built before deploying:

```bash
# Build TypeScript code
yarn build

# This should create a dist/ directory with your compiled Lambda handlers
```

## Step 7: Deploy

```bash
# Set environment variables
export STAGE=dev
export AWS_REGION=eu-west-1

# Bootstrap CDK (first time only)
cdk bootstrap

# Synthesize CloudFormation template
cdk synth

# Deploy to AWS
cdk deploy --profile your-aws-profile
```

## Step 8: Update and Deploy Changes

```bash
# After making changes to your infrastructure
cdk diff                    # See what will change
cdk deploy                  # Deploy changes
```

## Common Patterns

### Multiple Environments

Create separate stacks for each environment:

```bash
STAGE=dev cdk deploy
STAGE=staging cdk deploy
STAGE=prod cdk deploy
```

### Adding More Resources

Simply add more constructs in your stack:

```typescript
// Add SQS queue
const queue = new EmSqsQueue(this, 'ProcessQueue', {
  stage,
  serviceName,
  queueName: 'process',
  enableDLQ: true
})

// Add SNS topic
const topic = new EmSnsTopic(this, 'EventTopic', {
  stage,
  serviceName,
  topicName: 'events'
})

// Subscribe queue to topic
topic.addSqsSubscription(queue.getQueue())
```

### Cross-Stack References

```typescript
// In database-stack.ts
export class DatabaseStack extends Stack {
  public readonly table: EmDynamoDBTable

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    this.table = new EmDynamoDBTable(this, 'Table', { ... })
  }
}

// In api-stack.ts
export class ApiStack extends Stack {
  constructor(
    scope: Construct, 
    id: string, 
    table: EmDynamoDBTable,
    props?: StackProps
  ) {
    super(scope, id, props)
    
    const lambda = new EmLambdaFunction(this, 'Handler', {
      environment: { TABLE_NAME: table.getTableName() }
    })
    
    table.grantReadData(lambda.getFunction())
  }
}

// In app.ts
const dbStack = new DatabaseStack(app, 'DatabaseStack', { ... })
const apiStack = new ApiStack(app, 'ApiStack', dbStack.table, { ... })
```

## Useful Commands

```bash
cdk list               # List all stacks
cdk synth              # Generate CloudFormation template
cdk diff               # Show differences
cdk deploy             # Deploy stack
cdk deploy --hotswap   # Fast deploy for dev (Lambda only)
cdk destroy            # Delete stack
cdk watch              # Watch for changes and auto-deploy
```

## Tips

1. **Use environment variables**: Don't hardcode values
2. **Test locally**: Use CDK watch mode during development
3. **Review diffs**: Always check `cdk diff` before deploying
4. **Tag everything**: Use `applyStandardTags` for all resources
5. **Follow naming conventions**: Use the provided naming utilities
6. **Grant minimal permissions**: Only grant what's needed

## Next Steps

- Read the [full documentation](./README.md)
- Check out [examples](./examples/)
- Review the [API reference](./API.md)
- See [migration guide](./README.md#migration-from-serverless-framework) if coming from Serverless Framework

