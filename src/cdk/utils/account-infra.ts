/**
 * Account-level AWS infrastructure shared across all eMarketeer services:
 * the VPC, private subnets, and the RDS security group that Lambda functions
 * need to reach the shared database cluster.
 *
 * These values are account-level constants — every service deploying into the
 * eMarketeer AWS account uses the same VPC/subnets/SG per stage. Keeping them
 * here avoids each service copy-pasting the same IDs.
 */

export type InfraStage = 'dev' | 'prod'

export interface AccountInfraConfig {
  readonly vpcId: string
  readonly privateSubnetIds: readonly string[]
  readonly rdsSecurityGroupId: string
}

export function getAccountInfraConfig(stage: InfraStage): AccountInfraConfig {
  switch (stage) {
    case 'dev':
      return {
        vpcId: 'vpc-d2fd89b5',
        privateSubnetIds: ['subnet-7c74d81a', 'subnet-de04eb84', 'subnet-e29b26aa'],
        rdsSecurityGroupId: 'sg-711c3f09'
      }
    case 'prod':
      return {
        vpcId: 'vpc-aeaf41cb',
        privateSubnetIds: ['subnet-dab14f80', 'subnet-e06ad686', 'subnet-14ea665c'],
        rdsSecurityGroupId: 'sg-427bda39'
      }
    default:
      throw new Error(`Unsupported infrastructure stage: ${stage as string}`)
  }
}
