import { Construct } from 'constructs'
import { Annotations } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Role, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { Stage, VpcConfig } from '../types'

export interface RdsVpcConfiguration {
  readonly vpcId: string
  readonly privateSubnetIds: readonly string[]
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
   * Security group description. Defaults to `'Lambda security group for RDS access'`.
   *
   * Override when migrating from Serverless Framework — CloudFormation treats the
   * description as immutable, so it must match the existing value to avoid a
   * disruptive security-group replacement.
   */
  readonly securityGroupDescription?: string
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

  // The imported subnets are only handed to Lambda's VpcConfig. We never read
  // `subnet.routeTable.routeTableId`, so acknowledge the CDK warning that
  // `fromSubnetId` emits for imports without route-table metadata.
  const privateSubnets = config.privateSubnetIds.map((subnetId, index) => {
    const subnet = ec2.Subnet.fromSubnetId(scope, `RdsPrivateSubnet${index}-${stage}`, subnetId)
    Annotations.of(subnet).acknowledgeWarning(
      '@aws-cdk/aws-ec2:noSubnetRouteTableId',
      'This construct only passes imported subnets to Lambda VpcConfig and does not require routeTableId metadata.'
    )
    return subnet
  })

  const lambdaSecurityGroup = new ec2.SecurityGroup(scope, `RdsLambdaSecurityGroup-${stage}`, {
    vpc,
    description: config.securityGroupDescription ?? 'Lambda security group for RDS access',
    allowAllOutbound: true
  })

  if (config.overrideLogicalIds?.securityGroup || config.manageSgEgress === false) {
    const cfnSg = lambdaSecurityGroup.node.defaultChild
    if (!(cfnSg instanceof ec2.CfnSecurityGroup)) {
      throw new Error(
        'Security group does not have a CfnSecurityGroup default child — ' +
          'cannot apply overrideLogicalIds.securityGroup or manageSgEgress.'
      )
    }
    if (config.overrideLogicalIds?.securityGroup) {
      cfnSg.overrideLogicalId(config.overrideLogicalIds.securityGroup)
    }
    if (config.manageSgEgress === false) {
      cfnSg.addPropertyDeletionOverride('SecurityGroupEgress')
    }
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
