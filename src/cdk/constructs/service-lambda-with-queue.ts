import { Construct } from 'constructs'
import { LambdaWithQueue, LambdaWithQueueProps } from './lambda-with-queue'

export interface ServiceLambdaWithQueueProps
  extends Omit<LambdaWithQueueProps, 'queueName' | 'roleName'> {
  queueBaseName: string
}

export class ServiceLambdaWithQueue extends Construct {
  public readonly lambdaWithQueue: LambdaWithQueue

  public get function() {
    return this.lambdaWithQueue.function
  }

  public get queue() {
    return this.lambdaWithQueue.queue
  }

  public get dlq() {
    return this.lambdaWithQueue.dlq
  }

  public get dlqAlarm() {
    return this.lambdaWithQueue.dlqAlarm
  }

  constructor(scope: Construct, id: string, props: ServiceLambdaWithQueueProps) {
    super(scope, id)

    const { queueBaseName, ...rest } = props

    this.lambdaWithQueue = new LambdaWithQueue(this, 'Default', {
      ...rest,
      functionName: `${props.stage}-${props.serviceName}-${rest.functionName}`,
      queueName: `${props.stage}-${props.serviceName}-${queueBaseName}`,
      roleName: `${props.stage}-${props.serviceName}-${rest.functionName}-role`
    })
  }
}
