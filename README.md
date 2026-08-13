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

Usage:

```
em-commons jest <tier?> <pattern...> [jest flags...]
```

The first argument may be a tier: `unit`, `func`, or `full-cycle`. It selects that tier's
files precisely — `func` means `*.func.test.ts` or `*-func.test.ts`, not "any path containing
func".

Every positional argument after the tier narrows the run further. Terms are combined with
AND, so adding an argument can only ever shrink the selected set:

```
em-commons jest func              # every *.func.test.ts
em-commons jest func contacts     # only *.func.test.ts files whose path contains contacts
em-commons jest func contacts sendout
em-commons jest func 'contacts|billing'
```

Arguments from the first `-`-prefixed one onward are forwarded to jest verbatim, so
`em-commons jest func contacts -t 'creates'` filters by test name as usual. Every narrowing
term must therefore come before the first flag: anything positional after a flag goes straight
to jest, which ORs it back into the same pattern space and widens the run — for example
`em-commons jest func -t 'creates' contacts` runs the entire func tier OR anything matching
`contacts`, unit and full-cycle files included, against dev AWS. `--testPathPattern` itself is
rejected outright for the same reason.

Use `--listTests` to preview exactly which files a run will execute before starting it —
useful for `func` and `full-cycle`, which run against real dev AWS:

```
em-commons jest func contacts --listTests
```

Matching is case-insensitive against the absolute path, which is jest's own behaviour. In a
repo checked out at `~/dev/contacts-service` the term `contacts` therefore matches every
file.

Please note that tests will run in parallel. The shared jest config does a global
setup/teardown before/after running your tests, except for the `unit` tier — unit tests don't
need the dev-AWS setup that func and full-cycle tests do. The decision is driven by the
`EM_JEST_TIER` environment variable, which the CLI sets from the resolved tier word before
invoking jest:

```json
  "globalSetup": "<rootDir>/src/utils/func-test-setup.ts",
  "globalTeardown": "<rootDir>/src/utils/func-test-teardown.ts",
```

If a service supplies its own `jest.config.js` instead of the shared one, make the same
decision with `process.env.EM_JEST_TIER !== 'unit'`.

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
  codePath: './dist/handlers/handler'
})

const table = new EmDynamoDBTable(this, 'MyTable', {
  stage: 'dev',
  serviceName: 'my-service',
  tableName: 'data',
  partitionKey: { name: 'id', type: AttributeType.STRING }
})
```
