export const config = `
frameworkVersion: ">=1.28.0 <2.0.0"

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

package:
  individually: true

plugins:
  - serverless-plugin-epsagon
  - serverless-webpack

custom:
  epsagon:
    token: "{{resolve:ssm:epsagon-token}}"
    appName: \${self:custom.name}
  webpack:
    webpackConfig: 'node_modules/em-ts-microservice-commons/dist/lib/webpack.config.js'
  region: \${opt:region, self:provider.region}
  stage: \${opt:stage, self:provider.stage}
  name: \${self:custom.stage}-\${self:service}
`
