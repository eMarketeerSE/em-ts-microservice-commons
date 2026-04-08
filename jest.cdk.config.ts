import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/cdk/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2020',
          module: 'CommonJS',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true
        }
      }
    ]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/cdk/**/*.ts', '!src/cdk/**/*.d.ts', '!src/cdk/examples/**']
}

export default config
