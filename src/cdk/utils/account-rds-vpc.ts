/**
 * Account-level RDS networking constants — the VPC, private subnets, and the
 * RDS security group that Lambda functions need to reach the shared database
 * cluster.
 *
 * These values are account-level constants: every service deploying into the
 * eMarketeer AWS account uses the same VPC/subnets/SG per stage. The VPC and
 * private subnets exist solely to give Lambdas a route to RDS — Lambdas that
 * don't talk to RDS do not need them.
 *
 * Designed to compose with `createRdsVpcConfig()` in `./rds-vpc`:
 *
 * ```typescript
 * const account = getAccountRdsVpcConfig(this.stage)
 * const vpcConfig = createRdsVpcConfig(this, this.stage, { ...account })
 * ```
 */

import { Stage } from '../types'

export interface AccountRdsVpcConfig {
  readonly vpcId: string
  readonly privateSubnetIds: readonly string[]
  readonly dbSecurityGroupId: string
}

export function getAccountRdsVpcConfig(stage: Stage): AccountRdsVpcConfig {
  switch (stage) {
    case 'dev':
      return {
        vpcId: 'vpc-d2fd89b5',
        privateSubnetIds: ['subnet-7c74d81a', 'subnet-de04eb84', 'subnet-e29b26aa'],
        dbSecurityGroupId: 'sg-711c3f09'
      }
    case 'prod':
      return {
        vpcId: 'vpc-aeaf41cb',
        privateSubnetIds: ['subnet-dab14f80', 'subnet-e06ad686', 'subnet-14ea665c'],
        dbSecurityGroupId: 'sg-427bda39'
      }
    default:
      throw new Error(`getAccountRdsVpcConfig: unsupported stage "${stage}". Only 'dev' and 'prod' are supported.`)
  }
}
