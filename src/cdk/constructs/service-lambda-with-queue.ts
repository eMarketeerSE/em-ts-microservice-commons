import { Construct } from 'constructs'
import { LambdaWithQueue, LambdaWithQueueProps } from './lambda-with-queue'
import { generateLambdaName, generateQueueName, generateRoleName } from '../utils/naming'
import { resolveHandlerPath } from '../utils/handler-path'

export interface ServiceLambdaWithQueueProps
  extends Omit<LambdaWithQueueProps, 'queueName' | 'roleName' | 'resourceName'> {
  queueBaseName: string
}

export class ServiceLambdaWithQueue extends LambdaWithQueue {
  constructor(scope: Construct, id: string, props: ServiceLambdaWithQueueProps) {
    const { queueBaseName, ...rest } = props
    const { functionName } = resolveHandlerPath(rest)

    super(scope, id, {
      ...rest,
      resourceName: functionName,
      functionName: generateLambdaName(props.stage, props.serviceName, functionName),
      queueName: generateQueueName(props.stage, props.serviceName, queueBaseName),
      roleName: rest.role
        ? undefined
        : generateRoleName(props.stage, props.serviceName, functionName)
    })
  }
}
