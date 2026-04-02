import { Duration } from 'aws-cdk-lib'
import {
  Runtime,
  Function as LambdaFunction,
  Code,
  Tracing,
  Architecture
} from 'aws-cdk-lib/aws-lambda'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { LambdaConfig } from '../types'
import { generateLambdaName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { getLogRetentionDays, getRemovalPolicy } from '../utils/logs'
import { createLambdaExecutionRole } from '../utils/iam'
import { buildRecapDevEnvironment, resolveRecapDevEndpoint } from '../utils/config'

export class EmLambdaFunction extends Construct {
  public readonly function: LambdaFunction

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id)

    const functionName = generateLambdaName(config.stage, config.serviceName, config.functionName)

    const role: IRole =
      config.role ??
      createLambdaExecutionRole(this, `${id}Role`, {
        roleName: config.functionName,
        stage: config.stage,
        serviceName: config.serviceName,
        assumedBy: 'lambda.amazonaws.com',
        managedPolicies: config.vpcConfig ? ['AWSLambdaVPCAccessExecutionRole'] : undefined
      })

    const logGroup = new LogGroup(this, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: getLogRetentionDays(config.stage),
      removalPolicy: getRemovalPolicy(config.stage)
    })

    this.function = new LambdaFunction(this, `${id}Function`, {
      functionName,
      runtime: config.runtime || Runtime.NODEJS_22_X,
      handler: config.handler,
      code: Code.fromAsset(config.codePath),
      memorySize: config.memorySize || 1024,
      timeout: config.timeout || Duration.seconds(15),
      environment: {
        ...config.environment,
        ...buildRecapDevEnvironment(resolveRecapDevEndpoint(this))
      },
      role,
      architecture: config.architecture ?? Architecture.ARM_64,
      tracing: config.enableTracing ? Tracing.ACTIVE : Tracing.DISABLED,
      reservedConcurrentExecutions: config.reservedConcurrentExecutions,
      retryAttempts: config.retryAttempts,
      logGroup,
      layers: config.layers,
      description: `${config.serviceName} - ${config.functionName}`,
      ...(config.vpcConfig && {
        vpc: config.vpcConfig.vpc,
        vpcSubnets: config.vpcConfig.vpcSubnets,
        securityGroups: config.vpcConfig.securityGroups
      })
    })

    applyStandardTags(this.function, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }
}
