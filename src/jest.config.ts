const esModules = ['@eMarketeerSE/runtime-commons'].join('|')

// Opt-in mode for services that depend on ESM-only packages (e.g. MikroORM).
// When EM_JEST_ESM_FRIENDLY=true:
//  - ts-jest compiles .ts as ESM (useESM), targeting es2022.
//  - extensionsToTreatAsEsm lets Jest load .ts through its ESM VM loader,
//    the same realm that handles ESM node_modules like @mikro-orm/*.
// Opting-in services must import { jest } from '@jest/globals' in test files
// that use jest.* APIs, since the `jest` global is CJS-only.
const rawEsmFriendly = process.env.EM_JEST_ESM_FRIENDLY
const esmFriendly = rawEsmFriendly?.trim().toLowerCase() === 'true'
if (rawEsmFriendly !== undefined && !esmFriendly) {
  // eslint-disable-next-line no-console
  console.warn(
    `[em-commons] EM_JEST_ESM_FRIENDLY=${JSON.stringify(rawEsmFriendly)} ignored;`
    + ' expected \'true\'. Falling back to default CJS Jest config.'
  )
}
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
  // Must match the set of TS extensions transformed above (^.+\.tsx?$), or Jest
  // will load .tsx as CJS while ts-jest emits ESM for it and blow up at import.
  config.extensionsToTreatAsEsm = ['.ts', '.tsx']
  // Previously this block wired in a `setupFiles` entry that called
  // `preloadMikroOrmModules` from runtime-commons. That preload goes through
  // the same Function-constructor dynamic-import path runtime-commons uses
  // for MikroORM and hits Jest's `importModuleDynamically` teardown
  // invariant on ~60–90% of multi-file -w 4 runs — whether called from
  // beforeAll or from a setupFile. Consumers that need a stable MikroORM
  // init under Jest ESM should import from `@eMarketeerSE/runtime-commons/mikroorm-esm`
  // (static ESM imports, routed via Jest's `loadEsmModule` which captures
  // the VM context once per file).
}

const shouldAddSetup = !process.argv.includes('unit')

if (shouldAddSetup) {
  config.globalSetup = '<rootDir>/src/utils/func-test-setup.ts'
  config.globalTeardown = '<rootDir>/src/utils/func-test-teardown.ts'
}

export default config
