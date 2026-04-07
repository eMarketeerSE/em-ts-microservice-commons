/**
 * Common EventBridge rule construct with standard configurations
 */

import { Rule, RuleProps, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction, SqsQueue, SnsTopic } from 'aws-cdk-lib/aws-events-targets'
import { Function as Lambda } from 'aws-cdk-lib/aws-lambda'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { EventBridgeRuleConfig } from '../types'
import { generateRuleName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'

/**
 * Standard EventBridge rule construct with eMarketeer defaults
 */
export class EmEventBridgeRule extends Construct {
  public readonly rule: Rule

  constructor(scope: Construct, id: string, config: EventBridgeRuleConfig) {
    super(scope, id)

    const ruleName = generateRuleName(config.stage, config.serviceName, config.ruleName)

    if (!config.eventPattern && !config.schedule) {
      throw new Error('Either eventPattern or schedule must be provided')
    }

    if (config.eventPattern && config.schedule) {
      throw new Error('Only one of eventPattern or schedule can be provided, not both')
    }

    const ruleProps: RuleProps = {
      ruleName,
      description: config.description || `${config.serviceName} - ${config.ruleName}`,
      enabled: config.enabled ?? true,
      ...(config.eventPattern && { eventPattern: config.eventPattern }),
      ...(config.schedule && { schedule: Schedule.expression(config.schedule) })
    }

    this.rule = new Rule(this, 'Rule', ruleProps)

    // Apply standard tags
    applyStandardTags(this.rule, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Get the rule
   */
  public getRule(): Rule {
    return this.rule
  }

  /**
   * Get the rule ARN
   */
  public getRuleArn(): string {
    return this.rule.ruleArn
  }

  /**
   * Get the rule name
   */
  public getRuleName(): string {
    return this.rule.ruleName
  }

  /**
   * Add a Lambda function as a target
   */
  public addLambdaTarget(lambda: Lambda, input?: RuleTargetInput) {
    this.rule.addTarget(
      new LambdaFunction(lambda, {
        event: input
      })
    )
  }

  /**
   * Add an SQS queue as a target
   */
  public addSqsTarget(queue: Queue, input?: RuleTargetInput) {
    this.rule.addTarget(
      new SqsQueue(queue, {
        message: input
      })
    )
  }

  /**
   * Add an SNS topic as a target
   */
  public addSnsTarget(topic: Topic, input?: RuleTargetInput) {
    this.rule.addTarget(
      new SnsTopic(topic, {
        message: input
      })
    )
  }
}

/**
 * Helper function to create an EventBridge rule
 */
export const createEventBridgeRule = (
  scope: Construct,
  id: string,
  config: EventBridgeRuleConfig
): EmEventBridgeRule => {
  return new EmEventBridgeRule(scope, id, config)
}

/**
 * Helper function to create a scheduled rule
 */
export const createScheduledRule = (
  scope: Construct,
  id: string,
  config: Omit<EventBridgeRuleConfig, 'eventPattern'> &
    Required<Pick<EventBridgeRuleConfig, 'schedule'>>
): EmEventBridgeRule => {
  return new EmEventBridgeRule(scope, id, config)
}

/**
 * Helper function to create an event pattern rule
 */
export const createEventPatternRule = (
  scope: Construct,
  id: string,
  config: Omit<EventBridgeRuleConfig, 'schedule'> &
    Required<Pick<EventBridgeRuleConfig, 'eventPattern'>>
): EmEventBridgeRule => {
  return new EmEventBridgeRule(scope, id, config)
}

/**
 * Common event patterns
 */
export const EVENT_PATTERNS = {
  /**
   * Match all events from a specific source
   */
  fromSource: (source: string) => ({
    source: [source]
  }),

  /**
   * Match specific detail type
   */
  detailType: (detailType: string) => ({
    detailType: [detailType]
  }),

  /**
   * Match events from a source with a specific detail type
   */
  sourceAndDetailType: (source: string, detailType: string) => ({
    source: [source],
    detailType: [detailType]
  }),

  /**
   * Match S3 object created events
   */
  s3ObjectCreated: (bucketName?: string) => ({
    source: ['aws.s3'],
    detailType: ['Object Created'],
    ...(bucketName ? { detail: { bucket: { name: [bucketName] } } } : {})
  }),

  /**
   * Match DynamoDB stream events
   */
  dynamoDbStream: (tableName?: string) => ({
    source: ['aws.dynamodb'],
    ...(tableName ? { resources: [{ prefix: `arn:aws:dynamodb:*:*:table/${tableName}` }] } : {})
  })
}
