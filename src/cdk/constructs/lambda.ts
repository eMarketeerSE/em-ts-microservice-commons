import { Duration } from 'aws-cdk-lib'
import { Function as LambdaFunction, Code, Tracing, Architecture } from 'aws-cdk-lib/aws-lambda'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { ILogGroup, LogGroup } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { LambdaConfig } from '../types'
import { generateLambdaName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { convertRetentionDays, getLogRetentionDays, getRemovalPolicy } from '../utils/logs'
import { createLambdaExecutionRole } from '../utils/iam'
import {
  buildRecapDevEnvironment,
  getLambdaEnvironmentVariables,
  resolveRecapDevEndpoint
} from '../utils/config'
import { DEFAULT_LAMBDA_RUNTIME } from '../utils/constants'

export class EmLambdaFunction extends Construct {
  public readonly function: LambdaFunction

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id)

    const functionName = generateLambdaName(config.stage, config.serviceName, config.functionName)

    const role: IRole =
      config.role ??
      createLambdaExecutionRole(this, 'Role', {
        roleName: config.functionName,
        stage: config.stage,
        serviceName: config.serviceName,
        managedPolicies: config.vpcConfig ? ['AWSLambdaVPCAccessExecutionRole'] : undefined
      })

    const logGroup: ILogGroup = config.importExistingLogGroup
      ? LogGroup.fromLogGroupName(this, `${id}LogGroup`, `/aws/lambda/${functionName}`)
      : new LogGroup(this, `${id}LogGroup`, {
          logGroupName: `/aws/lambda/${functionName}`,
          retention:
            convertRetentionDays(config.logRetentionDays) ?? getLogRetentionDays(config.stage),
          removalPolicy: getRemovalPolicy(config.stage)
        })

    this.function = new LambdaFunction(this, 'Function', {
      functionName,
      runtime: config.runtime ?? DEFAULT_LAMBDA_RUNTIME,
      handler: config.handler,
      code: Code.fromAsset(config.codePath),
      memorySize: config.memorySize ?? 1024,
      timeout: config.timeout ?? Duration.seconds(15),
      environment: {
        ...getLambdaEnvironmentVariables(config.stage),
        ...(config.environment ?? {}),
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
      customTags: config.tags
    })
  }
}
