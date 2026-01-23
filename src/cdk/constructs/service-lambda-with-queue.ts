import { Duration } from 'aws-cdk-lib'
import { ITopic } from 'aws-cdk-lib/aws-sns'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'
import { LambdaWithQueue } from './lambda-with-queue'
import { Stage, VpcConfig } from '../types'

export interface ServiceLambdaWithQueueProps {
  functionName: string
  queueBaseName: string
  handlerPath: string
  stage: Stage
  serviceName: string
  environment: Record<string, string>
  reservedConcurrency: number
  batchSize: number
  reportBatchItemFailures: boolean
  memorySize: number
  timeout: Duration
  enableTracing: boolean
  tags: Record<string, string>
  alarmTopic: ITopic | null
  snsTopics: ITopic[]
  rawMessageDelivery: boolean
  additionalQueues: Queue[]
  vpcConfig?: VpcConfig
}

export class ServiceLambdaWithQueue extends LambdaWithQueue {
  constructor(scope: Construct, id: string, props: ServiceLambdaWithQueueProps) {
    const physicalFunctionName = `${props.stage}-${props.serviceName}-${props.functionName}`
    const physicalQueueName = `${props.stage}-${props.serviceName}-${props.queueBaseName}`
    const physicalRoleName = `${props.stage}-${props.serviceName}-${props.functionName}-role`

    super(scope, id, {
      functionName: physicalFunctionName,
      queueName: physicalQueueName,
      roleName: physicalRoleName,
      handlerPath: props.handlerPath,
      reservedConcurrency: props.reservedConcurrency,
      batchSize: props.batchSize,
      reportBatchItemFailures: props.reportBatchItemFailures,
      stage: props.stage,
      serviceName: props.serviceName,
      environment: props.environment,
      memorySize: props.memorySize,
      timeout: props.timeout,
      enableTracing: props.enableTracing,
      tags: props.tags,
      alarmTopic: props.alarmTopic,
      snsTopics: props.snsTopics,
      rawMessageDelivery: props.rawMessageDelivery,
      additionalQueues: props.additionalQueues,
      vpcConfig: props.vpcConfig
    })
  }
}
