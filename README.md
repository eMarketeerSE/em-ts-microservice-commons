# eMarketeer TypeScript Microservice Commons

A common config for eMarketeer TypeScript microservice

### Contents ###

- Common `ts.config.json`
- Common webpack config
- Common parts of `serverless.yml` including Epsagon configuration
- Common eslint config
- Common jest config
- **AWS CDK v2 constructs and utilities** (see [CDK README](src/cdk/README.md))

### How to use ###

1. Clone `em-ts-microservice-starter`
2. Rename all occurences of `em-ts-microservice-starter` to whatever your service is going to be named


### Scripts ###

Following commands are available:

- `em-commons lint`
- `em-commons tsc`
- `em-commons jest`
- `em-commons deploy`
- `em-commons invoke-local`


#### jest ####

Please note that test will run in parallel. If you need to do a global setup/teardown before/after running your tests, the default configuration is like this:

```json
  "globalSetup": "<rootDir>/src/utils/func-test-setup.ts",
  "globalTeardown": "<rootDir>/src/utils/func-test-teardown.ts",
```

Example `func-test-setup.ts` file:

```typescript
import { addCurrentHostToSecurityGroup, initTestRuntime } from './test.utils'

const setup = async () => {
  await initTestRuntime()
  await addCurrentHostToSecurityGroup('...', ...)
}

export default setup
```

Example `func-test-teardown.ts` file:

```typescript
import { removeCurrentHostFromSecurityGroup } from './test.utils'

const teardown = async () => {
  await removeCurrentHostFromSecurityGroup('...', ...)
}

export default teardown
```


#### invoke-local ####

This command runs a lambda locally. 

Example usage:

`yarn invoke-local -f example-handler  -d "hello world"`

Where `-f` is the function name and `-d` is the request data.

More information on arguments is available here: https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke-local/

#### test local ####
In this directory:

`yarn build`

`yarn link`

In project directory:
`yarn link @emarketeer/ts-microservice-commons`

To unlink:
`yarn unlink @emarketeer/ts-microservice-commons`


#### release ####
Create a commit following the syntax of https://github.com/semantic-release/semantic-release#commit-message-format

## CDK v2 Support

This package now includes comprehensive AWS CDK v2 constructs and utilities for building microservices infrastructure.

See the [CDK Documentation](src/cdk/README.md) for:
- Lambda, DynamoDB, API Gateway, SQS, SNS, and EventBridge constructs
- Utility functions for naming, tagging, IAM policies, and logging
- Best practices and migration guidance from Serverless Framework
- Complete examples and usage patterns

Quick example:

```typescript
import { EmLambdaFunction, EmDynamoDBTable } from '@emarketeer/ts-microservice-commons/cdk'

const lambda = new EmLambdaFunction(this, 'MyFunction', {
  stage: 'dev',
  serviceName: 'my-service',
  functionName: 'handler',
  handler: 'index.handler',
  codePath: './dist'
})

const table = new EmDynamoDBTable(this, 'MyTable', {
  stage: 'dev',
  serviceName: 'my-service',
  tableName: 'data',
  partitionKey: { name: 'id', type: AttributeType.STRING }
})
```
