import { Construct } from 'constructs'
import { LambdaWithQueue, LambdaWithQueueProps } from './lambda-with-queue'

export interface ServiceLambdaWithQueueProps
  extends Omit<LambdaWithQueueProps, 'queueName' | 'roleName'> {
  queueBaseName: string
}

export class ServiceLambdaWithQueue extends LambdaWithQueue {
  constructor(scope: Construct, id: string, props: ServiceLambdaWithQueueProps) {
    const { queueBaseName, ...rest } = props

    super(scope, id, {
      ...rest,
      functionName: `${props.stage}-${props.serviceName}-${rest.functionName}`,
      queueName: `${props.stage}-${props.serviceName}-${queueBaseName}`,
      roleName: `${props.stage}-${props.serviceName}-${rest.functionName}-role`
    })
  }
}
