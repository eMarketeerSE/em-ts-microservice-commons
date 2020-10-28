export const config = `

provider:
  name: aws
  region: eu-west-1
  runtime: nodejs12.x
  deploymentBucket: \${self:custom.stage}.\${self:provider.region}.serverless.deploys.em.com
  versionFunctions: false
  tracing: false
  logRetentionInDays: 14
  iamRoleStatements:
    \${file(roleStatements.yml)}
  environment:
    stage: \${self:custom.stage}
    RECAP_DEV_SYNC_ENDPOINT: \${ssm:recap-dev-sync-endpoint}

package:
  individually: true

plugins:
  - "@recap.dev/serverless-plugin"
  - serverless-webpack

custom:
  webpack:
    webpackConfig: 'node_modules/@emarketeer/ts-microservice-commons/dist/lib/webpack.config.js'
  region: \${opt:region, self:provider.region}
  stage: \${opt:stage, self:provider.stage}
  name: \${self:custom.stage}-\${self:service}
`
