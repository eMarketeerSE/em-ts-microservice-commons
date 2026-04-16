import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Role, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { Stage, VpcConfig } from '../types'

export interface RdsVpcConfiguration {
  readonly vpcId: string
  readonly privateSubnetIds: string[]
  readonly dbSecurityGroupId: string
  /** Override CloudFormation logical IDs for migration. */
  readonly overrideLogicalIds?: {
    readonly securityGroup?: string
    readonly ingress?: string
  }
  /** DB port. Defaults to 3306 (MySQL). */
  readonly dbPort?: number
  /** When provided, auto-attaches AWSLambdaVPCAccessExecutionRole to the role. */
  readonly sharedRole?: Role
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

  const lambdaSecurityGroup = new ec2.SecurityGroup(scope, `RdsLambdaSecurityGroup-${stage}`, {
    vpc,
    description: 'Lambda security group for RDS access',
    allowAllOutbound: true
  })

  if (config.overrideLogicalIds?.securityGroup) {
    const cfnSg = lambdaSecurityGroup.node.defaultChild
    if (!(cfnSg instanceof ec2.CfnSecurityGroup)) {
      throw new Error(
        `Cannot override security group logical ID to "${config.overrideLogicalIds.securityGroup}": ` +
          'security group does not have a CfnSecurityGroup default child.'
      )
    }
    cfnSg.overrideLogicalId(config.overrideLogicalIds.securityGroup)
  }

  const ingress = new ec2.CfnSecurityGroupIngress(scope, `RdsIngress-${stage}`, {
    groupId: config.dbSecurityGroupId,
    ipProtocol: 'tcp',
    fromPort: config.dbPort ?? 3306,
    toPort: config.dbPort ?? 3306,
    sourceSecurityGroupId: lambdaSecurityGroup.securityGroupId,
    description: 'Allow Lambda to access RDS'
  })

  if (config.overrideLogicalIds?.ingress) {
    ingress.overrideLogicalId(config.overrideLogicalIds.ingress)
  }

  if (config.sharedRole) {
    config.sharedRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    )
  }

  return {
    vpc,
    vpcSubnets: { subnets: privateSubnets },
    securityGroups: [lambdaSecurityGroup]
  }
}
