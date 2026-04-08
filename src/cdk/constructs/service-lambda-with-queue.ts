import { Construct } from 'constructs'
import { LambdaWithQueue, LambdaWithQueueProps } from './lambda-with-queue'
import { generateLambdaName, generateQueueName, generateRoleName } from '../utils/naming'

export interface ServiceLambdaWithQueueProps
  extends Omit<LambdaWithQueueProps, 'queueName' | 'roleName' | 'resourceName'> {
  queueBaseName: string
}

export class ServiceLambdaWithQueue extends LambdaWithQueue {
  constructor(scope: Construct, id: string, props: ServiceLambdaWithQueueProps) {
    const { queueBaseName, ...rest } = props

    super(scope, id, {
      ...rest,
      resourceName: rest.functionName,
      functionName: generateLambdaName(props.stage, props.serviceName, rest.functionName),
      queueName: generateQueueName(props.stage, props.serviceName, queueBaseName),
      roleName: generateRoleName(props.stage, props.serviceName, rest.functionName)
    })
  }
}
