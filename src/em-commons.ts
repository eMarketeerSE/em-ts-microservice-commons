#!/usr/bin/env node
import spawn from 'cross-spawn'
import { cleanup, generateConfig } from './serverless.utils'
import * as fs from 'fs'

process.on('unhandledRejection', err => {
  throw err
})

const args = process.argv.slice(2)

const scriptIndex = args.findIndex(x => x === 'lint' || x === 'deploy' || x === 'tsc')

const script = scriptIndex === -1 ? args[0] : args[scriptIndex]

const scriptArgs = args.slice(scriptIndex + 1)

let result

if (script === 'lint') {
  fs.copyFileSync('node_modules/em-ts-microservice-commons/dist/tsconfig.json', './tsconfig.json')
  console.log(
    'running npx',
    ['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc', ...scriptArgs].join(
      ' '
    )
  )
  result = spawn.sync(
    'npx',
    ['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc', ...scriptArgs],
    { stdio: 'inherit' }
  )
  fs.unlinkSync('./tsconfig.json')
}

if (script === 'deploy') {
  generateConfig()
  console.log(
    'running cross-env NODE_OPTIONS=--max_old_space_size=4096 npx serverless deploy --config generated.serverless.yml'
  )
  fs.copyFileSync('node_modules/em-ts-microservice-commons/dist/tsconfig.json', './tsconfig.json')
  result = spawn.sync(
    'npx',
    [
      'cross-env',
      'NODE_OPTIONS=--max_old_space_size=4096',
      'npx',
      'serverless',
      'deploy',
      '--config',
      'generated.serverless.yml',
      ...scriptArgs
    ],
    { stdio: 'inherit' }
  )
  fs.unlinkSync('./tsconfig.json')
  cleanup()
}

if (script === 'tsc') {
  console.log('running npx tsc --noEmit')
  fs.copyFileSync('node_modules/em-ts-microservice-commons/dist/tsconfig.json', './tsconfig.json')
  result = spawn.sync('npx', ['tsc', '--noEmit', ...scriptArgs], { stdio: 'inherit' })
  fs.unlinkSync('./tsconfig.json')
}

if (script === 'jest') {
  console.log(
    'running npx jest --config node_modules/em-ts-microservice-commons/dist/jest.config.json'
  )
  fs.copyFileSync('node_modules/em-ts-microservice-commons/dist/tsconfig.json', './tsconfig.json')
  result = spawn.sync(
    'npx',
    [
      'jest',
      '--config',
      'node_modules/em-ts-microservice-commons/dist/jest.config.json',
      ...scriptArgs
    ],
    { stdio: 'inherit' }
  )
  fs.unlinkSync('./tsconfig.json')
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
