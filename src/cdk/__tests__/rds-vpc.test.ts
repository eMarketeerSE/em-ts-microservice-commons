import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { createRdsVpcConfig } from '../utils/rds-vpc'

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

const BASE_CONFIG = {
  vpcId: 'vpc-12345',
  privateSubnetIds: ['subnet-aaa', 'subnet-bbb'],
  dbSecurityGroupId: 'sg-db12345'
}

describe('createRdsVpcConfig', () => {
  it('creates a Lambda security group (R1)', () => {
    const stack = makeStack()
    createRdsVpcConfig(stack, 'dev', BASE_CONFIG)
    const template = Template.fromStack(stack)
    const sgs = template.findResources('AWS::EC2::SecurityGroup')
    expect(Object.keys(sgs).length).toBeGreaterThanOrEqual(1)
  })

  it('creates an ingress rule on the DB security group', () => {
    const stack = makeStack()
    createRdsVpcConfig(stack, 'dev', BASE_CONFIG)
    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      GroupId: 'sg-db12345',
      IpProtocol: 'tcp'
    })
  })

  it('defaults dbPort to 3306', () => {
    const stack = makeStack()
    createRdsVpcConfig(stack, 'dev', BASE_CONFIG)
    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      FromPort: 3306,
      ToPort: 3306
    })
  })

  it('overrides security group logical ID', () => {
    const stack = makeStack()
    createRdsVpcConfig(stack, 'dev', {
      ...BASE_CONFIG,
      overrideLogicalIds: { securityGroup: 'LambdaSecurityGroupDev' }
    })
    const template = Template.fromStack(stack)
    expect(template.findResources('AWS::EC2::SecurityGroup')).toHaveProperty(
      'LambdaSecurityGroupDev'
    )
  })

  it('overrides ingress rule logical ID', () => {
    const stack = makeStack()
    createRdsVpcConfig(stack, 'dev', {
      ...BASE_CONFIG,
      overrideLogicalIds: { ingress: 'RdsSecurityGroupIngressDev' }
    })
    const template = Template.fromStack(stack)
    expect(template.findResources('AWS::EC2::SecurityGroupIngress')).toHaveProperty(
      'RdsSecurityGroupIngressDev'
    )
  })

  it('attaches AWSLambdaVPCAccessExecutionRole to sharedRole', () => {
    const stack = makeStack()
    const role = new Role(stack, 'SharedRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    })
    createRdsVpcConfig(stack, 'dev', { ...BASE_CONFIG, sharedRole: role })
    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::IAM::Role', {
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
            ]
          ]
        }
      ]
    })
  })

  it('returns vpc, vpcSubnets, and securityGroups containing the created SG', () => {
    const stack = makeStack()
    const result = createRdsVpcConfig(stack, 'dev', BASE_CONFIG)
    expect(result).toHaveProperty('vpc')
    expect(result).toHaveProperty('vpcSubnets')
    expect(result).toHaveProperty('securityGroups')
    expect(result.securityGroups).toHaveLength(1)
  })
})
