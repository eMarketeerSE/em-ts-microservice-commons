/**
 * Common Lambda function construct with standard configurations
 */

import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import {
  Runtime,
  Function as LambdaFunction,
  Code,
  Tracing,
  Architecture
} from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { LambdaConfig } from '../types'
import { generateLambdaName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { getLogRetentionDays } from '../utils/logs'
import { createLambdaExecutionRole } from '../utils/iam'

/**
 * Standard Lambda function construct with eMarketeer defaults
 */
export class EmLambdaFunction extends Construct {
  public readonly function: LambdaFunction

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id)

    const functionName = generateLambdaName(config.stage, config.serviceName, config.functionName)

    // Create execution role
    const role = createLambdaExecutionRole(this, `${id}Role`, {
      roleName: config.functionName,
      stage: config.stage,
      serviceName: config.serviceName,
      assumedBy: 'lambda.amazonaws.com'
    })

    // Create Lambda function
    this.function = new LambdaFunction(this, `${id}Function`, {
      functionName,
      runtime: config.runtime || Runtime.NODEJS_22_X,
      handler: config.handler,
      code: Code.fromAsset(config.codePath),
      memorySize: config.memorySize || 1024,
      timeout: config.timeout || Duration.seconds(15),
      environment: config.environment || {},
      role,
      architecture: Architecture.ARM_64,
      tracing: config.enableTracing ? Tracing.ACTIVE : Tracing.DISABLED,
      reservedConcurrentExecutions: config.reservedConcurrentExecutions,
      retryAttempts: config.retryAttempts || 2,
      logRetention: config.logRetentionDays ? getLogRetentionDays(config.stage) : undefined,
      description: `${config.serviceName} - ${config.functionName}`,
      ...(config.vpcConfig && {
        vpc: config.vpcConfig.vpc,
        vpcSubnets: config.vpcConfig.vpcSubnets,
        securityGroups: config.vpcConfig.securityGroups
      })
    })

    // Apply standard tags
    applyStandardTags(this.function, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Get the Lambda function
   */
  public getFunction(): LambdaFunction {
    return this.function
  }

  /**
   * Get the function ARN
   */
  public getFunctionArn(): string {
    return this.function.functionArn
  }

  /**
   * Get the function name
   */
  public getFunctionName(): string {
    return this.function.functionName
  }

  /**
   * Grant invoke permissions to another resource
   */
  public grantInvoke(grantee: any) {
    return this.function.grantInvoke(grantee)
  }
}

/**
 * Helper function to create a Lambda function with minimal config
 */
export const createLambdaFunction = (
  scope: Construct,
  id: string,
  config: LambdaConfig
): EmLambdaFunction => {
  return new EmLambdaFunction(scope, id, config)
}
