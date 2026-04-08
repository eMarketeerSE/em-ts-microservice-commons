# eMarketeer CDK Commons

AWS CDK v2 constructs and utilities for eMarketeer microservices. Handles Serverless Framework migration transparently.

## Installation

```bash
yarn add @emarketeer/ts-microservice-commons aws-cdk-lib@^2.0.0 constructs@^10.0.0
```

## Getting Started

### Project structure

```
your-service/
├── cdk/
│   ├── bin/
│   │   └── app.ts
│   ├── lib/
│   │   ├── config/
│   │   │   └── stages.ts
│   │   └── stacks/
│   │       └── my-service-stack.ts
│   ├── test/
│   │   └── my-service-stack.test.ts
│   ├── cdk.json
│   └── tsconfig.json
├── src/
│   └── handlers/
└── package.json
```

### cdk.json

```json
{
  "app": "ts-node cdk/bin/app.ts",
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"]
  }
}
```

### bin/app.ts

```typescript
#!/usr/bin/env node
import 'source-map-support/register'
import { createEmApp } from '@emarketeer/ts-microservice-commons/cdk'
import { MyServiceStack } from '../lib/stacks/my-service-stack'
import { getStageConfig } from '../lib/config/stages'

const { app, stage } = createEmApp({ validStages: ['dev', 'prod'] })
const cfg = getStageConfig(stage)

new MyServiceStack(app, `my-service-${stage}`, {
  stage,
  serviceName: 'my-service',
  env: { account: cfg.accountId, region: cfg.region }
})

app.synth()
```

### Stack

```typescript
import { Construct } from 'constructs'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import {
  EmStack,
  EmStackProps,
  EmDynamoDBTable,
  EmRestApi
} from '@emarketeer/ts-microservice-commons/cdk'

export class MyServiceStack extends EmStack {
  constructor(scope: Construct, id: string, props: EmStackProps) {
    super(scope, id, props)

    const table = new EmDynamoDBTable(this, 'DataTable', {
      stage: this.stage,
      serviceName: this.serviceName,
      tableName: 'data',
      partitionKey: { name: 'id', type: AttributeType.STRING }
    })

    const getHandler = this.createFunction('GetHandler', {
      functionName: 'get-data',
      handler: 'index.handler',
      codePath: './dist/handlers/get-data',
      environment: { TABLE_NAME: table.getTableName() }
    })

    table.grantReadData(getHandler.function)

    const api = new EmRestApi(this, 'Api', {
      stage: this.stage,
      serviceName: this.serviceName,
      apiName: 'main',
      defaultCorsOptions: { allowOrigins: ['*'], allowMethods: ['GET', 'POST'] }
    })

    api.addLambdaIntegration('/data/{id}', 'GET', getHandler.function)
  }
}
```

### Stage handling

`createEmApp()` reads the stage from CDK context (`-c stage=...`) and defaults to `'dev'`:

```bash
cdk deploy                  # Deploys dev (default)
cdk deploy -c stage=prod    # Deploys prod
```

Pass `validStages` to restrict which values are accepted — anything else throws an error.

### Deploy

```bash
cdk synth -c stage=dev      # Generate template
cdk diff -c stage=dev       # Review changes
cdk deploy -c stage=dev     # Deploy
```

## EmStack

Base stack class. Provides:

- Auto-generated stack name (`{stage}-{serviceName}-stack`) and description
- Standard tags on all resources (Stage, Service, ManagedBy)
- `createFunction()` — creates Lambdas (with Serverless-compatible logical IDs when `useSharedRole: true`)
- `addOutput()` — creates exports with `sls-{service}-{stage}-{key}` pattern
- Optional shared IAM role via `useSharedRole: true` (enables migration mode)

## Serverless Framework Migration

`EmStack` handles migration transparently. Pass `useSharedRole: true` to match the
Serverless Framework's single-role pattern, and use `createFunction()` — logical IDs
are automatically overridden to match Serverless naming.

```typescript
export class ScreenshotServiceStack extends EmStack {
  constructor(scope: Construct, id: string, props: ScreenshotServiceStackProps) {
    super(scope, id, { ...props, useSharedRole: true })

    // createFunction() auto-overrides logical IDs:
    //   Lambda:   CaptureDashscreenshotDashfromDashurlLambdaFunction
    //   LogGroup: CaptureDashscreenshotDashfromDashurlLogGroup (RETAIN)
    const captureScreenshot = this.createFunction('CaptureScreenshot', {
      functionName: 'capture-screenshot-from-url',
      handler: 'index.handler',
      codePath: './dist/handlers/capture-screenshot-from-url'
    })

    overrideLayerLogicalId(chromiumLayer, 'ChromiumLayerLambdaLayer')
    this.addOutput('ServiceEndpoint', api.getApiUrl())
  }
}
```

| Concern | How |
|---|---|
| Shared IAM role | `useSharedRole: true` — pinned to `IamRoleLambdaExecution` |
| Lambda logical IDs | Auto-overridden by `createFunction()` |
| Log group logical IDs | Auto-overridden, removal policy RETAIN |
| Layer logical IDs | `overrideLayerLogicalId(layer, logicalId)` |
| Cross-stack exports | `this.addOutput(id, value)` |

New services omit `useSharedRole` — each function gets its own role and CDK default logical IDs.

### Migration checklist

1. Create CDK stack extending `EmStack` with `useSharedRole: true`
2. Use `createFunction()` for each Lambda — function names must match `serverless.yml` keys
3. Run `cdk diff` — verify updates only, no replacements (`[+]`/`[-]` pairs = bad)
4. Deploy to dev, verify data is intact, then deploy to prod

### Protecting stateful resources

**DynamoDB tables** — ensure logical ID and table name match:

```typescript
const table = new EmDynamoDBTable(this, 'ContactsTable', { ... })
// Override if Serverless used a different logical ID:
const cfnTable = table.table.node.defaultChild as CfnTable
cfnTable.overrideLogicalId('ContactsDynamoDbTable')
```

**Log groups** — `createFunction()` automatically sets RETAIN.

**Rollback** — CloudFormation rolls back on failure. RETAIN policies protect data even on stack deletion.

### Low-level utilities

For edge cases where `createFunction()` doesn't fit:

```typescript
import {
  overrideFunctionLogicalIds,
  overrideRoleLogicalId,
  overrideLayerLogicalId,
  createServerlessCompatibleOutput,
  toServerlessLogicalIdPrefix
} from '@emarketeer/ts-microservice-commons/cdk'
```

## Constructs

### EmLambdaFunction

```typescript
const fn = new EmLambdaFunction(this, 'GetContact', {
  stage: 'dev',
  serviceName: 'contacts',
  functionName: 'get-contact',
  handler: 'index.handler',
  codePath: './dist/handlers/get-contact',
  memorySize: 1024,
  timeout: Duration.seconds(30),
  environment: { TABLE_NAME: table.getTableName() }
})
```

Defaults: Node.js 24.x, ARM64, 1024 MB, 15s timeout.

### EmDynamoDBTable

```typescript
const table = new EmDynamoDBTable(this, 'UserTable', {
  stage: 'dev',
  serviceName: 'contacts',
  tableName: 'users',
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.NUMBER }
})

// Or single-table pattern:
const table = createSingleTable(this, 'Data', {
  stage: 'dev',
  serviceName: 'contacts',
  tableName: 'contacts',
  globalSecondaryIndexes: [GSI_PATTERNS.singleTableGSI('GSI1')]
})
```

### EmRestApi / EmHttpApi

```typescript
const api = new EmRestApi(this, 'Api', {
  stage: 'dev',
  serviceName: 'contacts',
  apiName: 'main',
  defaultCorsOptions: { allowOrigins: ['*'] }
})

api.addLambdaIntegration('/contacts', 'GET', fn.function)
```

### EmSqsQueue

```typescript
const queue = createQueueWithDLQ(this, 'ProcessQueue', {
  stage: 'dev',
  serviceName: 'contacts',
  queueName: 'process',
  maxReceiveCount: 3
})
```

### EmSnsTopic

```typescript
const topic = new EmSnsTopic(this, 'Events', {
  stage: 'dev',
  serviceName: 'contacts',
  topicName: 'events'
})

topic.addLambdaSubscription(fn.function)
topic.addSqsSubscription(queue.getQueue())
```

### EmEventBridgeRule

```typescript
const rule = new EmEventBridgeRule(this, 'DailySync', {
  stage: 'dev',
  serviceName: 'contacts',
  ruleName: 'daily-sync',
  schedule: 'rate(1 day)'
})

rule.addLambdaTarget(fn.function)
```

## Utilities

### Naming

```typescript
generateLambdaName('dev', 'contacts', 'get-contact')  // dev-contacts-get-contact
generateTableName('prod', 'contacts', 'data')          // prod-contacts-table-data
generateQueueName('dev', 'contacts', 'process')        // dev-contacts-queue-process
```

### IAM Helpers

```typescript
fn.function.addToRolePolicy(createDynamoDBAccessPolicy(table.getTableArn()))
fn.function.addToRolePolicy(createS3ReadPolicy('my-bucket'))
```

### Configuration

```typescript
const limits = getResourceLimits('prod')
// { lambdaMemory: 1024, lambdaTimeout: 30, ... }

isProduction('prod')   // true
isDevelopment('dev')    // true
```

### Presets

```typescript
LAMBDA_PRESETS.apiHandler      // { memorySize: 1024, timeout: 30s }
LAMBDA_PRESETS.queueProcessor  // { memorySize: 1024, timeout: 5min }
DYNAMODB_PRESETS.singleTable   // Single-table design defaults
CORS_PRESETS.allowAll          // Allow all origins
```
