describe('shared jest config ESM-friendly mode', () => {
  const originalEsmFriendly = process.env.EM_JEST_ESM_FRIENDLY

  afterEach(() => {
    if (originalEsmFriendly === undefined) {
      delete process.env.EM_JEST_ESM_FRIENDLY
    } else {
      process.env.EM_JEST_ESM_FRIENDLY = originalEsmFriendly
    }
    jest.resetModules()
  })

  it('should preload the reflect polyfill for every test file in ESM-friendly mode', () => {
    process.env.EM_JEST_ESM_FRIENDLY = 'true'
    jest.resetModules()

    const config = require('../jest.config').default

    expect(config.setupFiles).toEqual(['reflect-metadata'])
  })

  it('should treat TypeScript files as ESM in ESM-friendly mode', () => {
    process.env.EM_JEST_ESM_FRIENDLY = 'true'
    jest.resetModules()

    const config = require('../jest.config').default

    expect(config.extensionsToTreatAsEsm).toEqual(['.ts', '.tsx'])
    expect(config.transform['^.+\\.tsx?$'][1]).toMatchObject({
      useESM: true,
      tsconfig: { target: 'es2022', module: 'esnext' }
    })
  })

  it('should not preload the reflect polyfill when ESM-friendly mode is off', () => {
    delete process.env.EM_JEST_ESM_FRIENDLY
    jest.resetModules()

    const config = require('../jest.config').default

    expect(config.setupFiles).toBeUndefined()
    expect(config.extensionsToTreatAsEsm).toBeUndefined()
    expect(config.transform['^.+\\.tsx?$'][1]).toMatchObject({
      useESM: false,
      tsconfig: { target: 'es6' }
    })
  })

  it('should fall back to the CJS config when the opt-in value is not true', () => {
    process.env.EM_JEST_ESM_FRIENDLY = 'yes'
    jest.resetModules()
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const config = require('../jest.config').default

    expect(config.setupFiles).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('EM_JEST_ESM_FRIENDLY="yes" ignored'))
    warn.mockRestore()
  })
})
