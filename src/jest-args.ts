const TIER_PATTERNS = new Map([
  ['unit', '[.-]unit\\.test\\.'],
  ['func', '[.-]func\\.test\\.'],
  ['full-cycle', '[.-]full-cycle\\.test\\.'],
])

export interface JestArgs {
  tier?: string
  args: string[]
}

export const buildJestArgs = (scriptArgs: string[]): JestArgs => {
  const firstFlagIndex = scriptArgs.findIndex((arg) => arg.startsWith('-'))
  const terms = firstFlagIndex === -1 ? scriptArgs : scriptArgs.slice(0, firstFlagIndex)
  const flags = firstFlagIndex === -1 ? [] : scriptArgs.slice(firstFlagIndex)

  const forwardsTestPathPattern = flags.some(
    (arg) => arg === '--testPathPattern' || arg.startsWith('--testPathPattern='),
  )

  if (forwardsTestPathPattern) {
    throw new Error(
      'em-commons jest does not support --testPathPattern, because jest joins every pattern '
        + 'with | and would widen the run instead of narrowing it. Pass narrowing terms '
        + 'positionally instead, for example: em-commons jest func contacts',
    )
  }

  const tierPattern = terms.length > 0 ? TIER_PATTERNS.get(terms[0]) : undefined
  const tier = tierPattern ? terms[0] : undefined
  const patterns = tierPattern ? [tierPattern, ...terms.slice(1)] : terms

  if (patterns.length === 0) {
    return { args: flags }
  }

  // Each term is grouped so that alternation inside it cannot escape the `.*` prefix.
  const testPathPattern = patterns.map((pattern) => `(?=.*(?:${pattern}))`).join('')

  return { tier, args: ['--testPathPattern', testPathPattern, ...flags] }
}
