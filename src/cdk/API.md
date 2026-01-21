# CDK Commons API Reference

## Constructs

### Lambda Functions

```typescript
import { EmLambdaFunction } from '@emarketeer/ts-microservice-commons/cdk'

class EmLambdaFunction extends Construct {
  constructor(scope: Construct, id: string, config: LambdaConfig)
  
  getFunction(): LambdaFunction
  getFunctionArn(): string
  getFunctionName(): string
  grantInvoke(grantee: any): Grant
}

function createLambdaFunction(scope, id, config): EmLambdaFunction
```

### DynamoDB Tables

```typescript
import { 
  EmDynamoDBTable,
  createSingleTable,
  createKeyValueTable,
  GSI_PATTERNS 
} from '@emarketeer/ts-microservice-commons/cdk'

class EmDynamoDBTable extends Construct {
  constructor(scope: Construct, id: string, config: DynamoDBTableConfig)
  
  getTable(): Table
  getTableArn(): string
  getTableName(): string
  grantReadData(grantee: any): Grant
  grantWriteData(grantee: any): Grant
  grantReadWriteData(grantee: any): Grant
  grantStreamRead(grantee: any): Grant
}

const GSI_PATTERNS = {
  byAttribute(attributeName: string, indexName?: string): DynamoDBGSIConfig
  byStatusAndTimestamp(indexName?: string): DynamoDBGSIConfig
  singleTableGSI(indexName?: string): DynamoDBGSIConfig
}
```

### API Gateway

```typescript
import { 
  EmRestApi,
  EmHttpApi,
  createRestApi,
  createHttpApi 
} from '@emarketeer/ts-microservice-commons/cdk'

class EmRestApi extends Construct {
  constructor(scope: Construct, id: string, config: RestApiConfig)
  
  addLambdaIntegration(path, method, handler, options?): Method
  getApi(): RestApi
  getApiUrl(): string
  getApiId(): string
}

class EmHttpApi extends Construct {
  constructor(scope: Construct, id: string, config: HttpApiConfig)
  
  addLambdaIntegration(path, method, handler): HttpRoute[]
  getApi(): HttpApi
  getApiUrl(): string | undefined
  getApiId(): string
}
```

### SQS Queues

```typescript
import { 
  EmSqsQueue,
  createQueue,
  createFifoQueue,
  createQueueWithDLQ 
} from '@emarketeer/ts-microservice-commons/cdk'

class EmSqsQueue extends Construct {
  constructor(scope: Construct, id: string, config: SqsQueueConfig)
  
  getQueue(): Queue
  getQueueArn(): string
  getQueueUrl(): string
  getQueueName(): string
  getDeadLetterQueue(): Queue | undefined
  grantSendMessages(grantee: any): Grant
  grantConsumeMessages(grantee: any): Grant
}
```

### SNS Topics

```typescript
import { 
  EmSnsTopic,
  createTopic,
  createFifoTopic 
} from '@emarketeer/ts-microservice-commons/cdk'

class EmSnsTopic extends Construct {
  constructor(scope: Construct, id: string, config: SnsTopicConfig)
  
  getTopic(): Topic
  getTopicArn(): string
  getTopicName(): string
  addEmailSubscription(email: string): Subscription
  addLambdaSubscription(lambda: LambdaFunction): Subscription
  addSqsSubscription(queue: Queue, rawMessageDelivery?: boolean): Subscription
  grantPublish(grantee: any): Grant
}
```

### EventBridge Rules

```typescript
import { 
  EmEventBridgeRule,
  createEventBridgeRule,
  createScheduledRule,
  createEventPatternRule,
  EVENT_PATTERNS 
} from '@emarketeer/ts-microservice-commons/cdk'

class EmEventBridgeRule extends Construct {
  constructor(scope: Construct, id: string, config: EventBridgeRuleConfig)
  
  getRule(): Rule
  getRuleArn(): string
  getRuleName(): string
  addLambdaTarget(lambda: Lambda, input?: RuleTargetInput): void
  addSqsTarget(queue: Queue, input?: RuleTargetInput): void
  addSnsTarget(topic: Topic, input?: RuleTargetInput): void
}

const EVENT_PATTERNS = {
  fromSource(source: string): EventPattern
  detailType(detailType: string): EventPattern
  sourceAndDetailType(source, detailType): EventPattern
  s3ObjectCreated(bucketName?: string): EventPattern
  dynamoDbStream(tableName?: string): EventPattern
}
```

## Utilities

### Naming

```typescript
import {
  generateStackName,
  generateResourceName,
  generateLambdaName,
  generateTableName,
  generateApiName,
  generateQueueName,
  generateTopicName,
  generateRuleName,
  generateLogGroupName,
  generateRoleName,
  isValidStage,
  stageToUpperCase
} from '@emarketeer/ts-microservice-commons/cdk'
```

### Tagging

```typescript
import {
  generateStandardTags,
  applyStandardTags,
  applyTags,
  mergeTags,
  getEnvironmentTags,
  getCostAllocationTags,
  getComplianceTags
} from '@emarketeer/ts-microservice-commons/cdk'
```

### Configuration

```typescript
import {
  getEnvironmentConfig,
  getStageEnvVar,
  getRequiredEnvVar,
  getLambdaEnvironmentVariables,
  isProduction,
  isDevelopment,
  getStageFromEnv,
  getResourceLimits,
  getTracingConfig,
  getAlarmThresholds
} from '@emarketeer/ts-microservice-commons/cdk'
```

### IAM

```typescript
import {
  createLambdaExecutionRole,
  createLambdaExecutionPolicy,
  createDynamoDBAccessPolicy,
  createDynamoDBReadPolicy,
  createDynamoDBWritePolicy,
  createSQSAccessPolicy,
  createSNSPublishPolicy,
  createS3AccessPolicy,
  createS3ReadPolicy,
  createSecretsManagerPolicy,
  createSSMParameterPolicy,
  createXRayTracingPolicy,
  createEventBridgePutEventsPolicy,
  createCloudWatchLogsPolicy,
  createKMSDecryptPolicy,
  createLambdaInvokePolicy,
  createStepFunctionsExecutionPolicy,
  createPolicyDocument
} from '@emarketeer/ts-microservice-commons/cdk'
```

### Logging

```typescript
import {
  getLogRetentionDays,
  convertRetentionDays,
  createLogGroup,
  createLambdaLogGroup,
  createApiGatewayLogGroup,
  getRemovalPolicy,
  shouldEnableLogInsights
} from '@emarketeer/ts-microservice-commons/cdk'
```

## Configuration Presets

```typescript
import {
  LAMBDA_PRESETS,
  DYNAMODB_PRESETS,
  SQS_PRESETS,
  CORS_PRESETS
} from '@emarketeer/ts-microservice-commons/cdk'

LAMBDA_PRESETS.small
LAMBDA_PRESETS.medium
LAMBDA_PRESETS.large
LAMBDA_PRESETS.xlarge
LAMBDA_PRESETS.apiHandler
LAMBDA_PRESETS.queueProcessor
LAMBDA_PRESETS.scheduledJob

DYNAMODB_PRESETS.payPerRequest
DYNAMODB_PRESETS.provisioned
DYNAMODB_PRESETS.singleTable
DYNAMODB_PRESETS.simpleIdTable
DYNAMODB_PRESETS.timeSeries

SQS_PRESETS.standard
SQS_PRESETS.longRunning
SQS_PRESETS.fifo

CORS_PRESETS.allowAll
CORS_PRESETS.strict(origins: string[])
CORS_PRESETS.readOnly
```

## Types

All TypeScript type definitions are exported:

```typescript
import type {
  Stage,
  EnvironmentConfig,
  BaseConstructConfig,
  LambdaConfig,
  DynamoDBTableConfig,
  DynamoDBGSIConfig,
  RestApiConfig,
  HttpApiConfig,
  SqsQueueConfig,
  SnsTopicConfig,
  EventBridgeRuleConfig,
  IamRoleConfig,
  LogGroupConfig,
  StackNamingConfig,
  TaggingConfig
} from '@emarketeer/ts-microservice-commons/cdk'
```

