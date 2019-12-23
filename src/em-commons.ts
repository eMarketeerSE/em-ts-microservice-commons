#!/usr/bin/env node
import { cleanup, generateServerlessConfig, runCommand } from './utils'

process.on('unhandledRejection', err => {
  throw err
})

const args = process.argv.slice(2)

const supportedCommands = ['lint', 'deploy', 'tsc', 'jest']

const scriptIndex = args.findIndex(x => supportedCommands.indexOf(x) !== -1)

const script = scriptIndex === -1 ? args[0] : args[scriptIndex]

const scriptArgs = args.slice(scriptIndex + 1)

let result
try {
  if (script === 'lint') {
    result = runCommand(
      'npx eslint -c node_modules/em-ts-microservice-commons/dist/.eslintrc',
      scriptArgs
    )
  }

  if (script === 'deploy') {
    generateServerlessConfig()

    result = runCommand(
      'npx cross-env NODE_OPTIONS=--max_old_space_size=4096 npx serverless deploy --config generated.serverless.yml',
      scriptArgs
    )
  }

  if (script === 'tsc') {
    result = runCommand('npx tsc --noEmit', scriptArgs)
  }

  if (script === 'jest') {
    result = runCommand(
      'npx jest --config node_modules/em-ts-microservice-commons/dist/jest.config.json',
      scriptArgs
    )
  }
} finally {
  cleanup()
}

if (result && result.signal) {
  if (result.signal === 'SIGKILL') {
    console.log(
      'The build failed because the process exited too early. ' +
        'This probably means the system ran out of memory or someone called ' +
        '`kill -9` on the process.'
    )
  } else if (result.signal === 'SIGTERM') {
    console.log(
      'The build failed because the process exited too early. ' +
        'Someone might have called `kill` or `killall`, or the system could ' +
        'be shutting down.'
    )
  }

  process.exit(result.status!)
}

process.exit(0)
