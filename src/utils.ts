import * as YAML from 'yaml'
import { mergeWith, isArray, uniq } from 'lodash-es'
import * as fs from 'fs'
import spawn from 'cross-spawn'

import { config } from './common.serverless'

const mergeCustomizer = (objValue: any, srcValue: any) => {
  if (isArray(objValue)) {
    return uniq(objValue.concat(srcValue))
  }
}

export const generateServerlessConfig = () => {
  const serviceConfig = YAML.parse(fs.readFileSync('./serverless.yml', 'utf8'))
  const commonConfig = YAML.parse(config)

  const generatedConfig = mergeWith(commonConfig, serviceConfig, mergeCustomizer)

  fs.writeFileSync('./generated.serverless.yml', YAML.stringify(generatedConfig))
}

export const cleanup = () => {
  if (fs.existsSync('./generated.serverless.yml')) {
    fs.unlinkSync('./generated.serverless.yml')
  }
}

export const runCommand = (command: string, additionalArgs: string[] = []) => {
  const commandParts = command.split(' ')

  const program = commandParts[0]
  const args = commandParts.slice(1).concat(additionalArgs)

  console.log('running ', program, args.join(' '))

  return spawn.sync(program, args, { stdio: 'inherit' })
}
