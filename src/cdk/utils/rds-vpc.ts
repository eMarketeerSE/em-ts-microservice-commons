import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Stage, VpcConfig } from '../types'

export interface RdsVpcConfiguration {
  readonly vpcId: string
  readonly privateSubnetIds: string[]
  readonly dbSecurityGroupId: string
}

export function createRdsVpcConfig(
  scope: Construct,
  stage: Stage,
  config: RdsVpcConfiguration
): VpcConfig {
  const vpc = ec2.Vpc.fromLookup(scope, `RdsVpc-${stage}`, {
    vpcId: config.vpcId
  })

  const privateSubnets = config.privateSubnetIds.map((subnetId, index) =>
    ec2.Subnet.fromSubnetId(scope, `RdsPrivateSubnet${index}-${stage}`, subnetId)
  )

  const dbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
    scope,
    `RdsDbSecurityGroup-${stage}`,
    config.dbSecurityGroupId
  )

  const lambdaSecurityGroup = new ec2.SecurityGroup(scope, `RdsLambdaSecurityGroup-${stage}`, {
    vpc,
    description: 'Lambda security group for RDS access',
    allowAllOutbound: true
  })

  dbSecurityGroup.addIngressRule(
    lambdaSecurityGroup,
    ec2.Port.tcp(3306),
    'Allow Lambda to access RDS'
  )

  return {
    vpc,
    vpcSubnets: { subnets: privateSubnets },
    securityGroups: [lambdaSecurityGroup]
  }
}
