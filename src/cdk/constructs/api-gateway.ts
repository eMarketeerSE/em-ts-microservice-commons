/**
 * Common API Gateway constructs (REST API and HTTP API)
 */

import { Duration } from 'aws-cdk-lib'
import {
  RestApi,
  LambdaIntegration,
  Cors,
  LogGroupLogDestination,
  AccessLogFormat,
  MethodLoggingLevel,
  EndpointType,
  SecurityPolicy
} from 'aws-cdk-lib/aws-apigateway'
import {
  HttpApi,
  CorsHttpMethod,
  HttpMethod,
  PayloadFormatVersion
} from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { RestApiConfig, HttpApiConfig } from '../types'
import { generateApiName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { createApiGatewayLogGroup } from '../utils/logs'

/**
 * Standard REST API construct with eMarketeer defaults
 */
export class EmRestApi extends Construct {
  public readonly api: RestApi
  public readonly logGroup: LogGroup

  constructor(scope: Construct, id: string, config: RestApiConfig) {
    super(scope, id)

    const apiName = generateApiName(config.stage, config.serviceName, config.apiName)

    // Create log group
    this.logGroup = createApiGatewayLogGroup(
      this,
      `${id}LogGroup`,
      config.stage,
      config.serviceName,
      config.apiName
    )

    // Create REST API
    this.api = new RestApi(this, `${id}Api`, {
      restApiName: apiName,
      description: config.description || `${config.serviceName} REST API`,
      deployOptions: {
        stageName: config.deployOptions?.stageName || config.stage,
        throttlingRateLimit: config.deployOptions?.throttleRateLimit || 10000,
        throttlingBurstLimit: config.deployOptions?.throttleBurstLimit || 5000,
        loggingLevel: this.getLoggingLevel(config.deployOptions?.loggingLevel),
        dataTraceEnabled: config.deployOptions?.dataTraceEnabled ?? config.stage !== 'prod',
        metricsEnabled: config.deployOptions?.metricsEnabled ?? true,
        accessLogDestination: new LogGroupLogDestination(this.logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields()
      },
      defaultCorsPreflightOptions: config.defaultCorsOptions
        ? {
            allowOrigins: config.defaultCorsOptions.allowOrigins,
            allowMethods: config.defaultCorsOptions.allowMethods || Cors.ALL_METHODS,
            allowHeaders: config.defaultCorsOptions.allowHeaders || Cors.DEFAULT_HEADERS,
            allowCredentials: config.defaultCorsOptions.allowCredentials
          }
        : undefined,
      endpointTypes: [EndpointType.REGIONAL],
      policy: undefined
    })

    // Apply standard tags
    applyStandardTags(this.api, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Get logging level enum from string
   */
  private getLoggingLevel(level?: string): MethodLoggingLevel {
    switch (level?.toUpperCase()) {
      case 'ERROR':
        return MethodLoggingLevel.ERROR
      case 'INFO':
        return MethodLoggingLevel.INFO
      case 'OFF':
        return MethodLoggingLevel.OFF
      default:
        return MethodLoggingLevel.INFO
    }
  }

  /**
   * Add a Lambda integration to a path
   */
  public addLambdaIntegration(
    path: string,
    method: string,
    handler: LambdaFunction,
    options?: any
  ) {
    const resource = this.api.root.resourceForPath(path)
    const integration = new LambdaIntegration(handler, options)
    return resource.addMethod(method, integration)
  }

  /**
   * Get the API
   */
  public getApi(): RestApi {
    return this.api
  }

  /**
   * Get the API URL
   */
  public getApiUrl(): string {
    return this.api.url
  }

  /**
   * Get the API ID
   */
  public getApiId(): string {
    return this.api.restApiId
  }
}

/**
 * Standard HTTP API construct with eMarketeer defaults
 */
export class EmHttpApi extends Construct {
  public readonly api: HttpApi

  constructor(scope: Construct, id: string, config: HttpApiConfig) {
    super(scope, id)

    const apiName = generateApiName(config.stage, config.serviceName, config.apiName)

    // Create HTTP API
    this.api = new HttpApi(this, `${id}Api`, {
      apiName,
      description: config.description || `${config.serviceName} HTTP API`,
      corsPreflight: config.corsOptions
        ? {
            allowOrigins: config.corsOptions.allowOrigins,
            allowMethods: config.corsOptions.allowMethods?.map(m => this.parseHttpMethod(m)) || [
              CorsHttpMethod.GET,
              CorsHttpMethod.POST,
              CorsHttpMethod.PUT,
              CorsHttpMethod.DELETE,
              CorsHttpMethod.OPTIONS
            ],
            allowHeaders: config.corsOptions.allowHeaders || ['Content-Type', 'Authorization'],
            allowCredentials: config.corsOptions.allowCredentials,
            maxAge: config.corsOptions.maxAge
          }
        : undefined
    })

    // Apply standard tags
    applyStandardTags(this.api, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Parse HTTP method string to enum
   */
  private parseHttpMethod(method: string): CorsHttpMethod {
    const methodMap: Record<string, CorsHttpMethod> = {
      GET: CorsHttpMethod.GET,
      POST: CorsHttpMethod.POST,
      PUT: CorsHttpMethod.PUT,
      DELETE: CorsHttpMethod.DELETE,
      PATCH: CorsHttpMethod.PATCH,
      HEAD: CorsHttpMethod.HEAD,
      OPTIONS: CorsHttpMethod.OPTIONS,
      ANY: CorsHttpMethod.ANY
    }
    return methodMap[method.toUpperCase()] || CorsHttpMethod.ANY
  }

  /**
   * Add a Lambda integration to a route
   */
  public addLambdaIntegration(path: string, method: string, handler: LambdaFunction) {
    const integration = new HttpLambdaIntegration(`${handler.functionName}Integration`, handler, {
      payloadFormatVersion: PayloadFormatVersion.VERSION_2_0
    })

    return this.api.addRoutes({
      path,
      methods: [this.parseHttpMethodV2(method)],
      integration
    })
  }

  /**
   * Parse HTTP method string to HttpMethod enum
   */
  private parseHttpMethodV2(method: string): HttpMethod {
    const methodMap: Record<string, HttpMethod> = {
      GET: HttpMethod.GET,
      POST: HttpMethod.POST,
      PUT: HttpMethod.PUT,
      DELETE: HttpMethod.DELETE,
      PATCH: HttpMethod.PATCH,
      HEAD: HttpMethod.HEAD,
      OPTIONS: HttpMethod.OPTIONS,
      ANY: HttpMethod.ANY
    }
    return methodMap[method.toUpperCase()] || HttpMethod.ANY
  }

  /**
   * Get the API
   */
  public getApi(): HttpApi {
    return this.api
  }

  /**
   * Get the API URL
   */
  public getApiUrl(): string | undefined {
    return this.api.url
  }

  /**
   * Get the API ID
   */
  public getApiId(): string {
    return this.api.httpApiId
  }
}

/**
 * Helper function to create a REST API
 */
export const createRestApi = (scope: Construct, id: string, config: RestApiConfig): EmRestApi => {
  return new EmRestApi(scope, id, config)
}

/**
 * Helper function to create an HTTP API
 */
export const createHttpApi = (scope: Construct, id: string, config: HttpApiConfig): EmHttpApi => {
  return new EmHttpApi(scope, id, config)
}
