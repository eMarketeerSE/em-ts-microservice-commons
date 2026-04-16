/**
 * Common API Gateway constructs (REST API and HTTP API)
 */

import {
  RestApi,
  LambdaIntegration,
  LambdaIntegrationOptions,
  Cors,
  LogGroupLogDestination,
  AccessLogFormat,
  MethodLoggingLevel,
  EndpointType,
  CfnBasePathMapping
} from 'aws-cdk-lib/aws-apigateway'
import {
  HttpApi,
  HttpStage,
  CorsHttpMethod,
  HttpMethod,
  PayloadFormatVersion,
  DomainName,
  ApiMapping,
  CfnApiMapping
} from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager'
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { ILogGroup, LogGroup } from 'aws-cdk-lib/aws-logs'
import { createHash } from 'crypto'
import { Construct } from 'constructs'
import { RestApiConfig, HttpApiConfig } from '../types'
import { generateApiName, generateLogGroupName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { createApiGatewayLogGroup } from '../utils/logs'

/**
 * Standard REST API construct with eMarketeer defaults
 */
export class EmRestApi extends Construct {
  public readonly api: RestApi
  public readonly logGroup: ILogGroup

  constructor(scope: Construct, id: string, config: RestApiConfig) {
    super(scope, id)

    const apiName = generateApiName(config.stage, config.serviceName, config.apiName)

    // Create or import log group
    this.logGroup = config.importExistingLogGroup
      ? LogGroup.fromLogGroupName(
          this,
          'LogGroup',
          `/aws/apigateway/${generateLogGroupName(
            config.stage,
            config.serviceName,
            config.apiName
          )}`
        )
      : createApiGatewayLogGroup(this, 'LogGroup', config.stage, config.serviceName, config.apiName)

    // Create REST API
    this.api = new RestApi(this, 'Api', {
      restApiName: apiName,
      description: config.description || `${config.serviceName} REST API`,
      deployOptions: {
        stageName: config.deployOptions?.stageName ?? config.stage,
        throttlingRateLimit: config.deployOptions?.throttleRateLimit ?? 10000,
        throttlingBurstLimit: config.deployOptions?.throttleBurstLimit ?? 5000,
        loggingLevel: this.getLoggingLevel(config.deployOptions?.loggingLevel),
        dataTraceEnabled: config.deployOptions?.dataTraceEnabled ?? false,
        metricsEnabled: config.deployOptions?.metricsEnabled ?? true,
        accessLogDestination: new LogGroupLogDestination(this.logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields()
      },
      defaultCorsPreflightOptions: config.defaultCorsOptions
        ? {
            allowOrigins: config.defaultCorsOptions.allowOrigins ?? Cors.ALL_ORIGINS,
            allowMethods: config.defaultCorsOptions.allowMethods || Cors.ALL_METHODS,
            allowHeaders: config.defaultCorsOptions.allowHeaders || Cors.DEFAULT_HEADERS,
            allowCredentials: config.defaultCorsOptions.allowCredentials
          }
        : undefined,
      endpointTypes: [this.resolveEndpointType(config.endpointType)],
      binaryMediaTypes: config.binaryMediaTypes,
      policy: undefined
    })

    // Apply standard tags
    applyStandardTags(this.api, {
      stage: config.stage,
      serviceName: config.serviceName,
      customTags: config.tags
    })
  }

  private resolveEndpointType(type?: 'EDGE' | 'REGIONAL' | 'PRIVATE'): EndpointType {
    switch (type) {
      case 'EDGE':
        return EndpointType.EDGE
      case 'PRIVATE':
        return EndpointType.PRIVATE
      default:
        return EndpointType.REGIONAL
    }
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
    options?: LambdaIntegrationOptions
  ) {
    const resource = this.api.root.resourceForPath(path)
    const integration = new LambdaIntegration(handler, options)
    return resource.addMethod(method, integration)
  }

  /**
   * Add a base path mapping to an existing custom domain.
   *
   * Use this when the domain was created externally (e.g. by serverless-domain-manager)
   * and you just need to point a base path at this API's deployment stage.
   *
   * @param domainName - The custom domain name (e.g. `'api.example.com'`)
   * @param options - Optional basePath (defaults to `''`) and logical ID override
   * @returns The CfnBasePathMapping resource
   *
   * @example
   * ```typescript
   * const mapping = restApi.addBasePathMapping('api.example.com', {
   *   basePath: 'screenshots',
   *   logicalId: 'ScreenshotBasePathMapping',
   * })
   * ```
   */
  public addBasePathMapping(
    domainName: string,
    options?: { basePath?: string; logicalId?: string }
  ): CfnBasePathMapping {
    const basePath = options?.basePath ?? ''
    const id = options?.logicalId ?? `${domainName.replace(/\./g, '')}BasePathMapping`

    const mapping = new CfnBasePathMapping(this, id, {
      domainName,
      restApiId: this.api.restApiId,
      stage: this.api.deploymentStage.stageName,
      basePath: basePath || undefined
    })

    mapping.node.addDependency(this.api)

    if (options?.logicalId) {
      mapping.overrideLogicalId(options.logicalId)
    }

    return mapping
  }

  /**
   * Add a V2 API mapping to an existing custom domain.
   *
   * Use this instead of `addBasePathMapping` when the domain was created by
   * serverless-domain-manager (which uses API Gateway V2 API mappings, not
   * V1 base path mappings).
   *
   * @param domainName - The custom domain name (e.g. `'api.example.com'`)
   * @param options - Optional basePath and logical ID override
   * @returns The CfnApiMapping resource
   *
   * @example
   * ```typescript
   * restApi.addApiMapping('api.example.com', {
   *   basePath: 'forms',
   *   logicalId: 'FormsApiMapping',
   * })
   * ```
   */
  public addApiMapping(
    domainName: string,
    options?: { basePath?: string; logicalId?: string }
  ): CfnApiMapping {
    const basePath = options?.basePath ?? ''
    const id = options?.logicalId ?? `${domainName.replace(/\./g, '')}ApiMapping`

    const mapping = new CfnApiMapping(this, id, {
      apiId: this.api.restApiId,
      domainName,
      stage: this.api.deploymentStage.stageName,
      apiMappingKey: basePath || undefined
    })

    mapping.node.addDependency(this.api)

    if (options?.logicalId) {
      mapping.overrideLogicalId(options.logicalId)
    }

    return mapping
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

  public readonly defaultStage: HttpStage

  private readonly domainNames = new Map<string, DomainName>()

  constructor(scope: Construct, id: string, config: HttpApiConfig) {
    super(scope, id)

    const apiName = generateApiName(config.stage, config.serviceName, config.apiName)

    // Create HTTP API
    this.api = new HttpApi(this, 'Api', {
      apiName,
      description: config.description || `${config.serviceName} HTTP API`,
      createDefaultStage: false,
      corsPreflight: config.corsOptions
        ? {
            allowOrigins: config.corsOptions.allowOrigins ?? ['*'],
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

    this.defaultStage = new HttpStage(this, 'DefaultStage', {
      httpApi: this.api,
      stageName: '$default',
      autoDeploy: true,
      ...(config.throttle && {
        throttle: {
          rateLimit: config.throttle.rateLimit,
          burstLimit: config.throttle.burstLimit
        }
      })
    })

    // Apply standard tags
    applyStandardTags(this.api, {
      stage: config.stage,
      serviceName: config.serviceName,
      customTags: config.tags
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
    const resolved = methodMap[method.toUpperCase()]
    if (!resolved) {
      throw new Error(
        `Unknown HTTP method: "${method}". Valid values: ${Object.keys(methodMap).join(', ')}`
      )
    }
    return resolved
  }

  /**
   * Add a Lambda integration to a route
   */
  public addLambdaIntegration(path: string, method: string, handler: LambdaFunction) {
    const id = `${createHash('sha256')
      .update(path + method)
      .digest('hex')
      .slice(0, 8)}Integration`
    const integration = new HttpLambdaIntegration(id, handler, {
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
    const resolved = methodMap[method.toUpperCase()]
    if (!resolved) {
      throw new Error(
        `Unknown HTTP method: "${method}". Valid values: ${Object.keys(methodMap).join(', ')}`
      )
    }
    return resolved
  }

  /**
   * Attach a custom domain with base path mapping to this HTTP API.
   * Returns the full base URL (e.g. https://api.example.com/mypath).
   */
  public addCustomDomain(domainName: string, certificateArn: string, basePath: string): string {
    const normalisedPath = basePath
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
    const mappingHash = createHash('sha256')
      .update(domainName + normalisedPath)
      .digest('hex')
      .slice(0, 8)

    let domain = this.domainNames.get(domainName)
    if (!domain) {
      const domainHash = createHash('sha256')
        .update(domainName)
        .digest('hex')
        .slice(0, 8)
      const certificate = Certificate.fromCertificateArn(
        this,
        `${domainHash}Certificate`,
        certificateArn
      )
      domain = new DomainName(this, `${domainHash}Domain`, { domainName, certificate })
      this.domainNames.set(domainName, domain)
    }

    new ApiMapping(this, `${mappingHash}Mapping`, {
      api: this.api,
      domainName: domain,
      ...(normalisedPath && { apiMappingKey: normalisedPath })
    })

    return normalisedPath ? `https://${domainName}/${normalisedPath}` : `https://${domainName}`
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
  public getApiUrl(): string {
    return this.defaultStage.url
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
