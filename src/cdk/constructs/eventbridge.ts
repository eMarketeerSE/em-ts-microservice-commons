/**
 * Common EventBridge rule construct with standard configurations
 */

import { Rule, RuleTargetInput, Schedule, EventPattern } from 'aws-cdk-lib/aws-events'
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

    // Prepare rule properties
    const ruleProps: any = {
      ruleName,
      description: config.description || `${config.serviceName} - ${config.ruleName}`,
      enabled: config.enabled ?? true
    }

    // Add event pattern or schedule
    if (config.eventPattern) {
      ruleProps.eventPattern = config.eventPattern as EventPattern
    } else if (config.schedule) {
      ruleProps.schedule = this.parseSchedule(config.schedule)
    } else {
      throw new Error('Either eventPattern or schedule must be provided')
    }

    // Create rule
    this.rule = new Rule(this, `${id}Rule`, ruleProps)

    // Apply standard tags
    applyStandardTags(this.rule, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Parse schedule string to Schedule object
   */
  private parseSchedule(schedule: string): Schedule {
    // Support rate() and cron() expressions
    if (schedule.startsWith('rate(')) {
      const match = schedule.match(/rate\((\d+)\s+(minute|minutes|hour|hours|day|days)\)/)
      if (match) {
        const [, value, unit] = match
        const duration = parseInt(value, 10)

        if (unit.startsWith('minute')) {
          return Schedule.rate({ minutes: duration } as any)
        } else if (unit.startsWith('hour')) {
          return Schedule.rate({ hours: duration } as any)
        } else if (unit.startsWith('day')) {
          return Schedule.rate({ days: duration } as any)
        }
      }
    } else if (schedule.startsWith('cron(')) {
      // Extract cron expression
      return Schedule.expression(schedule)
    }

    // Default to expression
    return Schedule.expression(schedule)
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
  config: Omit<EventBridgeRuleConfig, 'eventPattern'>
): EmEventBridgeRule => {
  if (!config.schedule) {
    throw new Error('Schedule must be provided for scheduled rules')
  }
  return new EmEventBridgeRule(scope, id, config)
}

/**
 * Helper function to create an event pattern rule
 */
export const createEventPatternRule = (
  scope: Construct,
  id: string,
  config: Omit<EventBridgeRuleConfig, 'schedule'>
): EmEventBridgeRule => {
  if (!config.eventPattern) {
    throw new Error('Event pattern must be provided for event pattern rules')
  }
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
