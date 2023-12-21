const esModules = ['@eMarketeerSE/runtime-commons'].join('|')

const config: any = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es6'
        },
        isolatedModules: true
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

const shouldAddSetup = !process.argv.includes('unit')

if (shouldAddSetup) {
  config.globalSetup = '<rootDir>/src/utils/func-test-setup.ts'
  config.globalTeardown = '<rootDir>/src/utils/func-test-teardown.ts'
}

export default config
