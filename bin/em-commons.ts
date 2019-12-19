#!/usr/bin/env node
import spawn from 'cross-spawn'

process.on('unhandledRejection', err => {
  throw err;
})

const args = process.argv.slice(2)

const scriptIndex = args.findIndex(
  x => x === 'lint' || x === 'deploy' || x === 'tsc'
)

const script = scriptIndex === -1 ? args[0] : args[scriptIndex]

const scriptArgs = args.slice(scriptIndex + 1)

let result
if (script === 'lint') {
  console.log('running npx', ['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc', ...scriptArgs].join(' '))
  result = spawn.sync(
    'npx',
    ['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc', ...scriptArgs],
    { stdio: 'inherit' }
  );
}

if (result && result.signal) {
  if (result.signal === 'SIGKILL') {
    console.log(
      'The build failed because the process exited too early. ' +
      'This probably means the system ran out of memory or someone called ' +
      '`kill -9` on the process.'
    );
  } else if (result.signal === 'SIGTERM') {
    console.log(
      'The build failed because the process exited too early. ' +
      'Someone might have called `kill` or `killall`, or the system could ' +
      'be shutting down.'
    );
  }

  process.exit(result.status!);
}

process.exit(0);
