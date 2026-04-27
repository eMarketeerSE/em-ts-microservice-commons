import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { RemovalPolicy } from 'aws-cdk-lib'
import { Stage } from '../types'
import {
  convertRetentionDays,
  getLogRetentionDays,
  getRemovalPolicy
} from '../utils/logs'

describe('convertRetentionDays', () => {
  it('returns undefined for undefined input', () => {
    expect(convertRetentionDays(undefined)).toBeUndefined()
  })

  it('maps a known retention value to the matching enum', () => {
    expect(convertRetentionDays(7)).toBe(RetentionDays.ONE_WEEK)
    expect(convertRetentionDays(30)).toBe(RetentionDays.ONE_MONTH)
  })

  it('rejects 0 explicitly to prevent silent INFINITE retention', () => {
    expect(() => convertRetentionDays(0)).toThrow(/INFINITE/)
  })

  it('throws on an unsupported retention value', () => {
    expect(() => convertRetentionDays(13)).toThrow(/Unsupported logRetentionDays value: 13/)
  })
})

describe('getLogRetentionDays', () => {
  it('maps each Stage to a retention period', () => {
    expect(getLogRetentionDays('prod')).toBe(RetentionDays.ONE_MONTH)
    expect(getLogRetentionDays('staging')).toBe(RetentionDays.TWO_WEEKS)
    expect(getLogRetentionDays('test')).toBe(RetentionDays.ONE_WEEK)
    expect(getLogRetentionDays('dev')).toBe(RetentionDays.THREE_DAYS)
  })

  it('throws on an unrecognised stage rather than silently defaulting', () => {
    expect(() => getLogRetentionDays('production' as Stage)).toThrow(/unknown stage/)
  })
})

describe('getRemovalPolicy', () => {
  it('retains in prod, destroys elsewhere', () => {
    expect(getRemovalPolicy('prod')).toBe(RemovalPolicy.RETAIN)
    expect(getRemovalPolicy('staging')).toBe(RemovalPolicy.DESTROY)
    expect(getRemovalPolicy('test')).toBe(RemovalPolicy.DESTROY)
    expect(getRemovalPolicy('dev')).toBe(RemovalPolicy.DESTROY)
  })

  it('throws on an unrecognised stage rather than silently defaulting to DESTROY', () => {
    expect(() => getRemovalPolicy('production' as Stage)).toThrow(/unknown stage/)
  })
})
