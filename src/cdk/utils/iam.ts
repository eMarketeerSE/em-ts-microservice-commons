/**
 * IAM role and policy helpers
 */

import { Effect, PolicyStatement, Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { IamRoleConfig } from '../types'
import { generateRoleName } from './naming'

/**
 * Create a Lambda execution role with standard permissions
 */
export const createLambdaExecutionRole = (
  scope: Construct,
  id: string,
  config: IamRoleConfig
): Role => {
  const roleName = generateRoleName(config.stage, config.serviceName, config.roleName)

  const role = new Role(scope, id, {
    roleName,
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    description: `Lambda execution role for ${config.serviceName}`
  })

  role.addManagedPolicy(
    ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  )

  if (config.managedPolicies?.includes('AWSLambdaVPCAccessExecutionRole')) {
    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    )
  }

  return role
}

/**
 * Create an X-Ray tracing policy statement
 */
export const createXRayTracingPolicy = (): PolicyStatement => {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
    resources: ['*']
  })
}
