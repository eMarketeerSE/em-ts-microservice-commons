import { Duration, Stack } from 'aws-cdk-lib'
import { Function as LambdaFunction, Code, Tracing, Architecture } from 'aws-cdk-lib/aws-lambda'
import { IRole, IManagedPolicy, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { ILogGroup, LogGroup } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { LambdaConfig } from '../types'
import { generateLambdaName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { convertRetentionDays, getLogRetentionDays, getRemovalPolicy } from '../utils/logs'
import { createLambdaExecutionRole } from '../utils/iam'
import { buildRecapDevEnvironment, resolveRecapDevEndpoint } from '../utils/config'
import { DEFAULT_LAMBDA_RUNTIME } from '../utils/constants'
import { resolveHandlerPath } from '../utils/handler-path'

export class EmLambdaFunction extends Construct {
  public readonly function: LambdaFunction

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id)

    const resolved = resolveHandlerPath(config)
    const functionName =
      config.physicalName ??
      generateLambdaName(config.stage, config.serviceName, resolved.functionName)

    const extraPolicies: IManagedPolicy[] = []
    if (config.vpcConfig) {
      extraPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'))
    }
    if (config.enableTracing) {
      extraPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'))
    }

    const role: IRole =
      config.role ??
      createLambdaExecutionRole(this, 'Role', {
        roleName: config.functionName,
        stage: config.stage,
        serviceName: config.serviceName,
        managedPolicies: extraPolicies.length ? extraPolicies : undefined
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
      handler: resolved.handler ?? config.handler,
      code: Code.fromAsset(resolved.codePath ?? config.codePath),
      memorySize: config.memorySize ?? 1024,
      timeout: config.timeout ?? Duration.seconds(15),
      environment: {
        STAGE: config.stage,
        NODE_ENV: config.stage === 'prod' ? 'production' : 'development',
        REGION: Stack.of(this).region,
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
