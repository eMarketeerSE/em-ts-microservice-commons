export const config = `

provider:
  name: aws
  region: eu-west-1
  runtime: nodejs14.x
  deploymentBucket: \${self:custom.stage}.\${self:provider.region}.serverless.deploys.em.com
  versionFunctions: false
  tracing:
    apiGateway: false
    lambda: false
  logRetentionInDays: 14
  memorySize: 1024
  timeout: 15
  iamRoleStatements:
    \${file(roleStatements.yml)}
  environment:
    stage: \${self:custom.stage}
    RECAP_DEV_SYNC_ENDPOINT: \${ssm:recap-dev-sync-endpoint}
    RECAP_DEV_TIMEOUT_WINDOW: 300

package:
  individually: true

plugins:
  - "@recap.dev/serverless-plugin"
  - serverless-webpack
  - serverless-plugin-lambda-insights

custom:
  webpack:
    webpackConfig: 'node_modules/@emarketeer/ts-microservice-commons/dist/lib/webpack.config.js'
  region: \${opt:region, self:provider.region}
  stage: \${opt:stage, self:provider.stage}
  name: \${self:custom.stage}-\${self:service}
  lambdaInsights:
    defaultLambdaInsights: true #enables Lambda Insights for all your functions
`
