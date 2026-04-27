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

No feature flags needed — `createEmApp()` automatically applies all CDK recommended feature flags (`CURRENTLY_RECOMMENDED_FLAGS` from `aws-cdk-lib/cx-api`).

```json
{
  "app": "ts-node cdk/bin/app.ts"
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

### Shared configs

Commons provides shared configs for CDK services:

```json
// cdk/tsconfig.json
{ "extends": "@emarketeer/ts-microservice-commons/cdk/tsconfig.json" }
```

```json
// cdk/.eslintrc
{ "extends": "@emarketeer/ts-microservice-commons/cdk/.eslintrc" }
```

```js
// jest.config.js
module.exports = require('@emarketeer/ts-microservice-commons/cdk/jest.config')
```

The CDK eslintrc includes `no-new: off` (CDK constructs use side-effect `new`) and all `aws-cdk-lib/*` submodules as core-modules.

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

    // Short form — derives codePath, handler, and functionName from handlerPath
    const getHandler = this.createFunction('GetHandler', {
      handlerPath: 'src/handlers/get-data',
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

### Feature flags

`createEmApp()` automatically applies all CDK recommended feature flags (`CURRENTLY_RECOMMENDED_FLAGS` from `aws-cdk-lib/cx-api`). Services don't need to list them in `cdk.json`.

To override a specific flag or add custom context:

```typescript
const { app, stage } = createEmApp({
  context: {
    '@aws-cdk/aws-lambda:recognizeLayerVersion': false,
    'my-custom-key': 'my-value',
  }
})
```

### CLI commands

```bash
em-commons cdk-test                     # Build handlers + run CDK tests
em-commons cdk-lint                     # Lint CDK code
em-commons cdk-synth -- -c stage=dev    # Build handlers + generate template
em-commons cdk-deploy -- -c stage=dev   # Build handlers + deploy
```

`cdk-test`, `cdk-synth`, and `cdk-deploy` automatically run `build-handlers` first. Typical `package.json` scripts:

```json
{
  "test:cdk": "em-commons cdk-test",
  "lint:cdk": "em-commons cdk-lint",
  "deploy:cdk": "em-commons cdk-deploy"
}
```

You can also run the steps manually:

```bash
em-commons build-handlers
cdk diff -c stage=dev
cdk deploy -c stage=dev
```

## EmStack

Base stack class. Provides:

- Auto-generated stack name: `{stage}-{serviceName}-stack` (or `{serviceName}-{stage}` when `useSharedRole: true` for Serverless compatibility)
- Standard tags on all resources (Stage, Service, ManagedBy, `em-microservice`)
- `createFunction()` — creates Lambdas (with Serverless-compatible logical IDs when `useSharedRole: true`)
- `createQueueConsumer()` — Lambda + SQS queue + DLQ + alarm
- `createScheduledFunction()` — Lambda + EventBridge rule
- `addOutput()` — creates exports with `sls-{service}-{stage}-{key}` pattern
- `ssmParam()` — SSM parameter lookup (convention-based or raw), `alarmTopic()` — alarm topic by convention
- IAM policy helpers (`addLambdaInvokePolicy`, `addKinesisPolicy`, `addSnsPublishPolicy`, `addSqsSendPolicy`)
- Optional shared IAM role via `useSharedRole: true` (enables migration mode)

### defaultFunctionConfig

Set shared defaults in the constructor or after construction with `setDefaultFunctionConfig()`. `environment` is deep-merged (per-function values override matching keys):

```typescript
super(scope, id, {
  ...props,
  useSharedRole: true,
  defaultFunctionConfig: {
    memorySize: 1024,
    enableTracing: true,
    timeout: Duration.seconds(60),
  }
})

// Set defaults that depend on resources created after super():
this.setDefaultFunctionConfig({
  environment: sharedEnvironment,
  vpcConfig,
})

// Functions inherit defaults — only specify overrides:
this.createFunction('GetData', { handlerPath: 'src/handlers/get-data' })

// Per-function environment merges with defaults:
this.createQueueConsumer('ProcessJobs', {
  handlerPath: 'src/handlers/process-jobs',
  queueName: '...',
  alarmTopic,
  environment: { EXTRA_VAR: 'value' },  // merged with sharedEnvironment
})
```

### IAM policy helpers

Add policies to the shared role (requires `useSharedRole: true`):

```typescript
this.addLambdaInvokePolicy()                                        // scoped to {stage}-{serviceName}-*
this.addLambdaInvokePolicy('dev-other-service-*')                    // custom scope
this.addKinesisPolicy('signals')                                     // kinesis:PutRecord/PutRecords → {stage}-signals
this.addSnsPublishPolicy(topic)                                      // sns:Publish → topic ARN
this.addSnsPublishPolicy('emarketeer-event-contact-event')           // sns:Publish → {stage}-{name}
this.addSqsSendPolicy('em-contacts-service-contact-source')          // sqs:SendMessage → {stage}-{name}
```

### createFunction() with handlerPath

`createFunction()` accepts a `handlerPath` to reduce boilerplate:

```typescript
// Instead of:
this.createFunction('CaptureScreenshot', {
  functionName: 'capture-screenshot-from-url',
  handler: 'index.handler',
  codePath: 'dist/handlers/capture-screenshot/capture-screenshot-from-url',
})

// You can write:
this.createFunction('CaptureScreenshot', {
  handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url',
})
```

`handlerPath` resolves:
- `codePath` to `dist/handlers/<relative-path>` (matching build-handlers output)
- `handler` to `index.handler`
- `functionName` to the last segment of the path

All three can still be overridden explicitly alongside `handlerPath`.

### Auto-injected environment variables

`EmLambdaFunction` automatically injects `STAGE`, `NODE_ENV`, and `REGION` into every Lambda's environment. Explicit values in `environment` take precedence.

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
      handlerPath: 'src/handlers/capture-screenshot-from-url',
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

### createQueueConsumer()

For Lambda functions consuming SQS queues. Works like `createFunction()` — defaults stage, serviceName, and role from the stack.

```typescript
const consumer = this.createQueueConsumer('ProcessJobs', {
  handlerPath: 'src/handlers/process-jobs',
  queueName: `${stage}-${serviceName}-jobs-queue`,
  alarmTopic,
  timeout: Duration.seconds(60),
})
```

In migration mode (`useSharedRole: true`), Lambda and log group logical IDs are overridden automatically. Queue/DLQ/alarm logical IDs can be overridden explicitly:

```typescript
this.createQueueConsumer('ProcessFormSubmit', {
  handlerPath: 'src/handlers/process-form-submit/process-form-submit',
  queueName: `${stage}-${serviceName}-form-submit-queue`,
  dlqName: `${stage}-${serviceName}-form-submit-dead-letter-queue`,
  alarmName: 'FormSubmitDeadLetterQueueAlarm',
  timeout: Duration.seconds(240),
  batchSize: 100,
  maxBatchingWindow: Duration.seconds(2),
  maxConcurrency: 6,
  alarmTopic,
  environment: { ...baseEnvironment },
  overrideLogicalIds: {
    queue: 'FormSubmitQueue',
    dlq: 'FormSubmitDeadLetterQueue',
    alarm: 'FormSubmitDeadLetterQueueAlarm',
  },
})
```

Defaults: memorySize=1024, timeout=15s, enableTracing=true, batchSize=10, maxReceiveCount=3.

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
import { Duration } from 'aws-cdk-lib'
import { EmLambdaFunction } from '@emarketeer/ts-microservice-commons/cdk'

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
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import { EmDynamoDBTable, createSingleTable, GSI_PATTERNS } from '@emarketeer/ts-microservice-commons/cdk'

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
  defaultCorsOptions: {}  // allowOrigins defaults to ['*']
})

api.addLambdaIntegration('/contacts', 'GET', fn.function)

// V2 API mapping — use when the domain was set up by serverless-domain-manager
api.addApiMapping('api.example.com', {
  basePath: 'contacts',
  logicalId: 'ContactsApiMapping',
})

// V1 base path mapping — use for domains managed via API Gateway V1
api.addBasePathMapping('api.example.com', {
  basePath: 'contacts',
  logicalId: 'ContactsBasePathMapping',
})
```

### EmSqsQueue

```typescript
const queue = createQueueWithDLQ(this, 'ProcessQueue', {
  stage: 'dev',
  serviceName: 'contacts',
  queueName: 'process',
  maxReceiveCount: 3
})

// Import an external queue URL by name convention:
const queueUrl = EmSqsQueue.urlFromName(this, 'dev', 'em-contacts-service-contact-source')
// → https://sqs.{region}.amazonaws.com/{account}/dev-em-contacts-service-contact-source
```

### EmSnsTopic

```typescript
const topic = new EmSnsTopic(this, 'Events', {
  stage: 'dev',
  serviceName: 'contacts',
  topicName: 'events',
  overrideLogicalId: 'EventsTopic',  // optional — for migration
})

topic.addLambdaSubscription(fn.function)
topic.addSqsSubscription(queue.getQueue())
```

Import an external topic by name convention:

```typescript
const contactEventTopic = EmSnsTopic.fromName(this, 'ContactEvent', {
  stage: 'dev',
  topicName: 'emarketeer-event-contact-event',
})
// ARN: arn:aws:sns:{region}:{account}:dev-emarketeer-event-contact-event
```

### TopicQueueConsumer

Wires up SNS subscription → SQS queue → DLQ + alarm → Lambda consumer in one construct:

```typescript
const consumer = new TopicQueueConsumer(this, 'ContactEvents', {
  topic: contactEventTopic,  // ITopic or ARN string
  handlerPath: 'src/handlers/process-contact-event',
  queueName: 'dev-my-service-contact-event-queue',
  alarmTopic,
})
```

Supports all `LambdaWithQueue` features: `handlerPath`, shared role, `overrideLogicalIds`, `serverlessFunctionName`, `visibilityTimeout`, `dlqName`, `alarmName`, etc.

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

Attach policies to the stack's shared role via the `add*Policy` methods on
`EmStack` (these supersede the standalone `create*Policy` helpers that
previously lived in `utils/iam.ts`):

```typescript
this.addDynamoDbPolicy([table])         // accepts ITable refs or short names
this.addS3Policy('my-bucket')           // accepts IBucket refs or names
this.addSnsPublishPolicy(topic)         // accepts ITopic refs or short names
this.addSqsSendPolicy(['outbound-queue'])
```

The methods require `useSharedRole: true` on the stack; for per-function role
permissions, attach policies to the function's role directly.

### Configuration

Stage-driven defaults are applied automatically by the constructs (memory,
timeout, log retention, removal policy, etc.). Lambdas receive `STAGE`,
`NODE_ENV`, and `REGION` env vars from `buildBaseEnvironment()` —
no caller code is required.

### Presets

```typescript
LAMBDA_PRESETS.apiHandler      // { memorySize: 1024, timeout: 30s }
LAMBDA_PRESETS.queueProcessor  // { memorySize: 1024, timeout: 5min }
DYNAMODB_PRESETS.singleTable   // Single-table design defaults
CORS_PRESETS.allowAll          // Allow all origins
```
