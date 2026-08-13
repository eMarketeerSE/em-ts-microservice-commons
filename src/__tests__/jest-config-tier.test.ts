describe('shared jest config tier handling', () => {
  const originalTier = process.env.EM_JEST_TIER

  afterEach(() => {
    if (originalTier === undefined) {
      delete process.env.EM_JEST_TIER
    } else {
      process.env.EM_JEST_TIER = originalTier
    }
    jest.resetModules()
  })

  it('should skip global setup and teardown for the unit tier', () => {
    process.env.EM_JEST_TIER = 'unit'
    jest.resetModules()

    const config = require('../jest.config').default

    expect(config.globalSetup).toBeUndefined()
    expect(config.globalTeardown).toBeUndefined()
  })

  it('should apply global setup and teardown for the func tier', () => {
    process.env.EM_JEST_TIER = 'func'
    jest.resetModules()

    const config = require('../jest.config').default

    expect(config.globalSetup).toBe('<rootDir>/src/utils/func-test-setup.ts')
    expect(config.globalTeardown).toBe('<rootDir>/src/utils/func-test-teardown.ts')
  })

  it('should apply global setup and teardown when no tier is set', () => {
    delete process.env.EM_JEST_TIER
    jest.resetModules()

    const config = require('../jest.config').default

    expect(config.globalSetup).toBe('<rootDir>/src/utils/func-test-setup.ts')
    expect(config.globalTeardown).toBe('<rootDir>/src/utils/func-test-teardown.ts')
  })
})
