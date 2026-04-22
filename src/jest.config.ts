const esModules = ['@eMarketeerSE/runtime-commons'].join('|')

// Opt-in mode for services that depend on ESM-only packages (e.g. MikroORM v7).
// When EM_JEST_ESM_FRIENDLY=true:
//  - ts-jest compiles .ts as ESM (useESM), targeting es2022.
//  - extensionsToTreatAsEsm lets Jest load .ts through its ESM VM loader,
//    the same realm that handles ESM node_modules like @mikro-orm/*.
// Opting-in services must import { jest } from '@jest/globals' in test files
// that use jest.* APIs, since the `jest` global is CJS-only.
const esmFriendly = process.env.EM_JEST_ESM_FRIENDLY === 'true'
const tsJestTsConfig: Record<string, string> = {
  target: esmFriendly ? 'es2022' : 'es6'
}
if (esmFriendly) {
  // useESM needs an ES module output from TS; otherwise ts-jest still emits
  // `exports.foo = ...` which explodes when Jest loads the file as ESM.
  tsJestTsConfig.module = 'esnext'
}

const config: any = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: tsJestTsConfig,
        isolatedModules: true,
        useESM: esmFriendly
      }
    ]
  },
  testRunner: 'jest-circus/runner',
  setupFilesAfterEnv: ['jest-extended'],
  rootDir: '../../../../../',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [`/node_modules/(?!${esModules})`]
}

if (esmFriendly) {
  config.extensionsToTreatAsEsm = ['.ts']
}

const shouldAddSetup = !process.argv.includes('unit')

if (shouldAddSetup) {
  config.globalSetup = '<rootDir>/src/utils/func-test-setup.ts'
  config.globalTeardown = '<rootDir>/src/utils/func-test-teardown.ts'
}

export default config
