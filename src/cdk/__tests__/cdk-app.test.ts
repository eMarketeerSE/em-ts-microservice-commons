import { App } from 'aws-cdk-lib'
import { createEmApp } from '../utils/cdk-app'

describe('createEmApp', () => {
  it('returns an App and a stage', () => {
    const result = createEmApp()
    expect(result.app).toBeInstanceOf(App)
    expect(typeof result.stage).toBe('string')
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
