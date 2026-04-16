import * as cdk from 'aws-cdk-lib'
import { CURRENTLY_RECOMMENDED_FLAGS } from 'aws-cdk-lib/cx-api'
import { Stage } from '../types'

export interface CreateEmAppOptions {
  /** Valid stage values. Defaults to all Stage values: dev, test, staging, prod */
  readonly validStages?: readonly Stage[]
  /** Default stage when no context is provided. Defaults to 'dev' */
  readonly defaultStage?: Stage
  /** Additional CDK context values. Applied after the standard feature flags. */
  readonly context?: Record<string, string | boolean | number>
}

export interface EmAppContext {
  readonly app: cdk.App
  readonly stage: Stage
}

/**
 * Create a CDK App with stage resolution from context.
 * Reads `-c stage=...` from CDK context, defaults to 'dev'.
 * Validates against allowed values and throws on invalid input.
 *
 * @example
 * ```typescript
 * const { app, stage } = createEmApp({ validStages: ['dev', 'prod'] })
 * const cfg = getStageConfig(stage)
 * new MyServiceStack(app, `my-service-${stage}`, { stage, ...cfg })
 * app.synth()
 * ```
 */
export const createEmApp = (options?: CreateEmAppOptions): EmAppContext => {
  const app = new cdk.App({
    context: {
      ...CURRENTLY_RECOMMENDED_FLAGS,
      ...options?.context
    }
  })
  const rawStage = app.node.tryGetContext('stage') ?? options?.defaultStage ?? 'dev'
  const validStages = options?.validStages ?? ['dev', 'test', 'staging', 'prod']

  if (!validStages.includes(rawStage)) {
    throw new Error(
      `Invalid --context stage="${rawStage}". Valid stages: ${validStages.join(', ')}`
    )
  }

  return { app, stage: rawStage as Stage }
}
