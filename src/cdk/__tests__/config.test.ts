import { App, Stack } from 'aws-cdk-lib'
import {
  buildRecapDevEnvironment,
  resolveRecapDevEndpoint,
  RECAP_DEV_TIMEOUT_WINDOW_SECONDS
} from '../utils/config'

describe('buildRecapDevEnvironment', () => {
  it('returns an empty object for undefined endpoint', () => {
    expect(buildRecapDevEnvironment(undefined)).toEqual({})
  })

  it('returns an empty object for the SSM dummy-value placeholder', () => {
    expect(buildRecapDevEnvironment('dummy-value-recap-dev-sync-endpoint')).toEqual({})
  })

  it('returns the env block for a valid https endpoint', () => {
    const result = buildRecapDevEnvironment('https://recap.example.com/sync')
    expect(result).toEqual({
      RECAP_DEV_SYNC_ENDPOINT: 'https://recap.example.com/sync',
      RECAP_DEV_TIMEOUT_WINDOW: String(RECAP_DEV_TIMEOUT_WINDOW_SECONDS)
    })
  })

  it('throws when the endpoint cannot be parsed as a URL', () => {
    expect(() => buildRecapDevEnvironment('not-a-url')).toThrow(/not a valid URL/)
  })

  it('throws when the endpoint protocol is neither http nor https', () => {
    expect(() => buildRecapDevEnvironment('ftp://recap.example.com')).toThrow(/http or https/)
  })
})

describe('resolveRecapDevEndpoint', () => {
  it('returns undefined when the stack account/region are unresolved tokens', () => {
    // No env passed → CDK uses tokens for account/region; SSM lookup must be
    // skipped because resolved env is required at lookup time.
    const app = new App()
    const stack = new Stack(app, 'TokenStack')
    expect(resolveRecapDevEndpoint(stack)).toBeUndefined()
  })
})
