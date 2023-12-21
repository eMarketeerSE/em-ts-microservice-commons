export const config = `
provider:
  name: aws
  region: eu-west-1
  runtime: nodejs20.x
  deploymentBucket: \${sls:stage}.\${self:provider.region}.serverless.deploys.em.com
  deploymentMethod: direct
  versionFunctions: false
  architecture: arm64
  stackTags:
    em-microservice: \${sls:stage}-\${self:service}
  tracing:
    apiGateway: false
    lambda: false
  logRetentionInDays: 14
  memorySize: 1024
  timeout: 15
  iamRoleStatements: \${file(roleStatements.yml)}
  environment:
    stage: \${sls:stage}
    RECAP_DEV_SYNC_ENDPOINT: \${ssm:recap-dev-sync-endpoint, ""}
    RECAP_DEV_TIMEOUT_WINDOW: 300

package:
  individually: true

plugins:
  - "@recap.dev/serverless-plugin"
  - serverless-esbuild
  - serverless-plugin-resource-tagging
  - serverless-plugin-lambda-insights

custom:
  esbuild:
    packager: yarn
    concurrency: 10
    nativeZip: true
    plugins: node_modules/@emarketeer/ts-microservice-commons/dist/esbuild-plugins.js
    minify: true
    external:
      - 'mysql'
      - 'pg'
      - 'pg-native'
      - 'sqlite3'
      - 'mssql'
      - 'oracledb'
      - 'better-sqlite3'
    exclude:
      - aws-sdk
      - '@aws-sdk/*'
  region: \${opt:region, self:provider.region}
  stage: \${sls:stage}
  name: \${sls:stage}-\${self:service}
  lambdaInsights:
    defaultLambdaInsights: true #enables Lambda Insights for all your functions
`
