import { App } from 'aws-cdk-lib'
import { CURRENTLY_RECOMMENDED_FLAGS } from 'aws-cdk-lib/cx-api'
import { createEmApp } from '../utils/cdk-app'

describe('createEmApp', () => {
  it('returns an App and a stage', () => {
    const result = createEmApp()
    expect(result.app).toBeInstanceOf(App)
    expect(typeof result.stage).toBe('string')
  })

  it('applies CDK recommended feature flags by default', () => {
    const { app } = createEmApp()
    expect(app.node.tryGetContext('@aws-cdk/aws-lambda:recognizeLayerVersion')).toBe(true)
    expect(app.node.tryGetContext('@aws-cdk/core:checkSecretUsage')).toBe(true)
  })

  it('applies all CURRENTLY_RECOMMENDED_FLAGS', () => {
    const { app } = createEmApp()
    for (const [key, value] of Object.entries(CURRENTLY_RECOMMENDED_FLAGS)) {
      expect(app.node.tryGetContext(key)).toEqual(value)
    }
  })

  it('allows custom context to override feature flags', () => {
    const { app } = createEmApp({
      context: { '@aws-cdk/aws-lambda:recognizeLayerVersion': false }
    })
    expect(app.node.tryGetContext('@aws-cdk/aws-lambda:recognizeLayerVersion')).toBe(false)
  })

  it('defaults to dev when no context is provided', () => {
    const { stage } = createEmApp()
    expect(stage).toBe('dev')
  })

  it('respects a custom defaultStage', () => {
    const { stage } = createEmApp({ defaultStage: 'staging' })
    expect(stage).toBe('staging')
  })

  it('supports custom validStages', () => {
    const { stage } = createEmApp({
      validStages: ['dev', 'prod'],
      defaultStage: 'prod'
    })
    expect(stage).toBe('prod')
  })

  it('throws when defaultStage is not in custom validStages', () => {
    expect(() =>
      createEmApp({
        validStages: ['dev', 'prod'],
        defaultStage: 'staging'
      })
    ).toThrow('Invalid --context stage="staging". Valid stages: dev, prod')
  })
})
