import { runCommand } from './utils'

process.on('unhandledRejection', err => {
  throw err
})

const args = process.argv.slice(2)

const supportedCommands = [
  'lint',
  'tsc',
  'jest',
  'build-handlers',
  'cdk-deploy',
  'cdk-synth',
  'cdk-test',
  'cdk-lint'
]

const BUILD_HANDLERS_CMD =
  'node node_modules/@emarketeer/ts-microservice-commons/dist/build-handlers.js'

function buildHandlersOrExit() {
  const buildResult = runCommand(BUILD_HANDLERS_CMD, [])
  if (!buildResult || buildResult.status !== 0) {
    process.exit(buildResult?.status ?? 1)
  }
}

const scriptIndex = args.findIndex(x => supportedCommands.indexOf(x) !== -1)

const script = scriptIndex === -1 ? args[0] : args[scriptIndex]

const scriptArgs = args.slice(scriptIndex + 1)

let result

if (script === 'lint') {
  result = runCommand(
    'npx eslint -c node_modules/@emarketeer/ts-microservice-commons/dist/.eslintrc',
    scriptArgs
  )
}

if (script === 'tsc') {
  result = runCommand('npx tsc --noEmit', scriptArgs)
}

if (script === 'build-handlers') {
  result = runCommand(BUILD_HANDLERS_CMD, scriptArgs)
}

if (script === 'cdk-deploy') {
  buildHandlersOrExit()
  result = runCommand('npx cdk deploy --require-approval never', scriptArgs)
}

if (script === 'cdk-synth') {
  buildHandlersOrExit()
  result = runCommand('npx cdk synth', scriptArgs)
}

if (script === 'cdk-test') {
  buildHandlersOrExit()
  result = runCommand(
    'npx jest --config node_modules/@emarketeer/ts-microservice-commons/dist/cdk/jest.config.js --rootDir cdk',
    scriptArgs
  )
}

if (script === 'cdk-lint') {
  result = runCommand(
    'npx eslint -c node_modules/@emarketeer/ts-microservice-commons/dist/cdk/.eslintrc',
    scriptArgs
  )
}

if (script === 'jest') {
  result = runCommand(
    'npx cross-env NODE_OPTIONS="--max_old_space_size=4096 --experimental-vm-modules" jest -w 4 --ci --forceExit --config node_modules/@emarketeer/ts-microservice-commons/dist/lib/jest.config.js',
    scriptArgs
  )
}

if (!supportedCommands.includes(script)) {
  console.error(`Unknown command: ${script}`)
  console.error(`Supported commands: ${supportedCommands.join(', ')}`)
  process.exit(1)
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

  process.exit(result.status ?? 1)
}

process.exit(result?.status ?? 1)
