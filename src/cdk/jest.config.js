/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'cdk/tsconfig.json',
    }],
  },
  modulePaths: ['<rootDir>/..'],
  setupFilesAfterEnv: ['aws-cdk-lib/testhelpers/jest-autoclean'],
}
