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
  /**
   * Security group description. Defaults to 'Lambda security group for RDS access'.
   * Use when the live Serverless stack has a different description — GroupDescription is
   * immutable in CloudFormation; a mismatch causes replacement.
   */
  readonly description?: string
  /**
   * When false, strips SecurityGroupEgress from the CloudFormation template.
   * Use for the initial Serverless→CDK migration deploy when the live stack never had
   * an explicit egress rule. Prevents rollback from revoking the default allow-all-outbound
   * rule. Remove this option in a follow-up deploy to hand CloudFormation ownership.
   */
  readonly manageSgEgress?: boolean
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
    description: config.description ?? 'Lambda security group for RDS access',
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

  if (config.manageSgEgress === false) {
    const cfnSg = lambdaSecurityGroup.node.defaultChild
    if (!(cfnSg instanceof ec2.CfnSecurityGroup)) {
      throw new Error(
        'Cannot strip SecurityGroupEgress: security group does not have a CfnSecurityGroup default child.'
      )
    }
    cfnSg.addPropertyDeletionOverride('SecurityGroupEgress')
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

  if (config.overrideLogicalIds?.securityGroup) {
    ingress.addPropertyOverride('SourceSecurityGroupId', {
      Ref: config.overrideLogicalIds.securityGroup
    })
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
