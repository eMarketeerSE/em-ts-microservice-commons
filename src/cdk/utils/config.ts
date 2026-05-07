import { Stack, Token } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { Stage } from '../types'

const RECAP_DEV_SSM_KEY = 'recap-dev-sync-endpoint'
const recapDevEndpointCache = new WeakMap<Stack, string>()

export const RECAP_DEV_TIMEOUT_WINDOW_SECONDS = 300

/**
 * Returns the standard base environment variables injected into every Lambda.
 * Centralised here so both EmLambdaFunction and LambdaWithQueue stay in sync.
 */
export const buildBaseEnvironment = (stage: Stage, scope: Construct): Record<string, string> => ({
  STAGE: stage,
  stage,
  NODE_ENV: stage === 'prod' ? 'production' : 'development',
  REGION: Stack.of(scope).region,
})

/**
 * Returns the env var block to inject for recap.dev, or an empty object.
 *
 * The `dummy-value-` early-return guards against CDK's SSM lookup placeholder:
 * `valueFromLookup` returns `dummy-value-…` strings during the first synth
 * before the cache file is populated, and we must not bake those into the
 * Lambda's environment.
 */
export const buildRecapDevEnvironment = (endpoint: string | undefined): Record<string, string> => {
  if (!endpoint || endpoint.startsWith('dummy-value-')) {
    return {}
  }

  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    throw new Error(`recap.dev endpoint is not a valid URL: "${endpoint}"`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`recap.dev endpoint must use http or https, got: ${parsed.protocol}`)
  }

  return {
    RECAP_DEV_SYNC_ENDPOINT: endpoint,
    RECAP_DEV_TIMEOUT_WINDOW: String(RECAP_DEV_TIMEOUT_WINDOW_SECONDS)
  }
}

/**
 * Resolves the recap.dev sync endpoint from SSM at synth time.
 * Cached per stack so the SSM lookup happens once per stack
 * regardless of how many constructs call this.
 */
export const resolveRecapDevEndpoint = (scope: Construct): string | undefined => {
  const stack = Stack.of(scope)
  if (Token.isUnresolved(stack.account) || Token.isUnresolved(stack.region)) {
    return undefined
  }
  if (!recapDevEndpointCache.has(stack)) {
    recapDevEndpointCache.set(stack, StringParameter.valueFromLookup(stack, RECAP_DEV_SSM_KEY))
  }
  return recapDevEndpointCache.get(stack)!
}
