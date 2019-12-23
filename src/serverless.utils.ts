import * as YAML from 'yaml'
import { merge } from 'lodash'
import { config } from './common.serverless'
import * as fs from 'fs'

export const generateConfig = () => {
  const serviceConfig = YAML.parse(fs.readFileSync('./serverless.yml', 'utf8'))
  const commonConfig = YAML.parse(config)

  const generatedConfig = merge(commonConfig, serviceConfig)

  fs.writeFileSync('./generated.serverless.yml', YAML.stringify(generatedConfig))
}

export const cleanup = () => {
  // fs.unlinkSync('./generated.serverless.yml')
}
