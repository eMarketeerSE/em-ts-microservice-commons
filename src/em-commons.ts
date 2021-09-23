import { cleanup, generateServerlessConfig, runCommand } from './utils'

process.on('unhandledRejection', err => {
  throw err
})

const args = process.argv.slice(2)

const supportedCommands = ['lint', 'deploy', 'tsc', 'jest', 'invoke-local']

const scriptIndex = args.findIndex(x => supportedCommands.indexOf(x) !== -1)

const script = scriptIndex === -1 ? args[0] : args[scriptIndex]

const scriptArgs = args.slice(scriptIndex + 1)

let result
try {
  if (script === 'lint') {
    result = runCommand(
      'npx eslint -c node_modules/@emarketeer/ts-microservice-commons/dist/.eslintrc',
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

  if (script === 'invoke-local') {
    generateServerlessConfig()

    result = runCommand(
      'npx cross-env DISABLE_EPSAGON=TRUE NODE_OPTIONS=--max_old_space_size=4096 npx serverless invoke local --config generated.serverless.yml',
      scriptArgs
    )
  }

  if (script === 'tsc') {
    result = runCommand('npx tsc --noEmit', scriptArgs)
  }

  if (script === 'jest') {
    result = runCommand(
      'npx cross-env NODE_OPTIONS=--max_old_space_size=4096 jest -w 8 --ci --forceExit --config node_modules/@emarketeer/ts-microservice-commons/dist/lib/jest.config.js',
      scriptArgs
    )
  }

  if (!supportedCommands.includes(script)) {
    generateServerlessConfig()

    result = runCommand(
      'npx cross-env NODE_OPTIONS=--max_old_space_size=4096 npx serverless --config generated.serverless.yml',
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

process.exit(result?.status!)
