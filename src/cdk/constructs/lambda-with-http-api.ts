import { Construct } from 'constructs'
import { EmLambdaFunction } from './lambda'
import { EmHttpApi } from './api-gateway'
import { LambdaConfig } from '../types'

export interface LambdaWithHttpApiConfig extends LambdaConfig {
  readonly httpApi: EmHttpApi
  readonly route: {
    path: string
    method: string
  }
}

export class EmLambdaWithHttpApi extends Construct {
  public readonly lambda: EmLambdaFunction

  constructor(scope: Construct, id: string, config: LambdaWithHttpApiConfig) {
    super(scope, id)

    this.lambda = new EmLambdaFunction(this, 'Lambda', config)

    config.httpApi.addLambdaIntegration(
      config.route.path,
      config.route.method,
      this.lambda.getFunction()
    )
  }

  public getFunction() {
    return this.lambda.getFunction()
  }

  public getFunctionArn() {
    return this.lambda.getFunctionArn()
  }

  public getFunctionName() {
    return this.lambda.getFunctionName()
  }
}
