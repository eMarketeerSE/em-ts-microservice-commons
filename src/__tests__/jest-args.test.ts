import { buildJestArgs } from '../jest-args'

describe('buildJestArgs', () => {
  it('should resolve a bare tier to its own lookahead', () => {
    expect(buildJestArgs(['func'])).toEqual({
      tier: 'func',
      args: ['--testPathPattern', '(?=.*(?:\\.func\\.test\\.))'],
    })
  })

  it('should narrow a tier with a pattern instead of widening it', () => {
    expect(buildJestArgs(['func', 'contacts'])).toEqual({
      tier: 'func',
      args: ['--testPathPattern', '(?=.*(?:\\.func\\.test\\.))(?=.*(?:contacts))'],
    })
  })

  it('should AND every additional pattern', () => {
    expect(buildJestArgs(['func', 'contacts', 'sendout'])).toEqual({
      tier: 'func',
      args: [
        '--testPathPattern',
        '(?=.*(?:\\.func\\.test\\.))(?=.*(?:contacts))(?=.*(?:sendout))',
      ],
    })
  })

  it('should group each pattern so alternation stays inside its own term', () => {
    expect(buildJestArgs(['func', 'contacts|billing'])).toEqual({
      tier: 'func',
      args: ['--testPathPattern', '(?=.*(?:\\.func\\.test\\.))(?=.*(?:contacts|billing))'],
    })
  })

  it('should treat a non-tier first argument as a plain pattern', () => {
    expect(buildJestArgs(['contacts'])).toEqual({
      args: ['--testPathPattern', '(?=.*(?:contacts))'],
    })
  })

  it('should not add a test path pattern when there are no arguments', () => {
    expect(buildJestArgs([])).toEqual({ args: [] })
  })

  it('should forward a flag and its value without treating the value as a pattern', () => {
    expect(buildJestArgs(['func', 'contacts', '-t', 'creates'])).toEqual({
      tier: 'func',
      args: [
        '--testPathPattern',
        '(?=.*(?:\\.func\\.test\\.))(?=.*(?:contacts))',
        '-t',
        'creates',
      ],
    })
  })

  it('should forward positionals that follow a flag verbatim', () => {
    expect(buildJestArgs(['func', '--coverage', 'contacts'])).toEqual({
      tier: 'func',
      args: ['--testPathPattern', '(?=.*(?:\\.func\\.test\\.))', '--coverage', 'contacts'],
    })
  })

  it('should resolve the unit tier', () => {
    expect(buildJestArgs(['unit'])).toEqual({
      tier: 'unit',
      args: ['--testPathPattern', '(?=.*(?:\\.unit\\.test\\.))'],
    })
  })

  it('should not treat a word merely containing a tier name as a tier', () => {
    expect(buildJestArgs(['unit-of-work'])).toEqual({
      args: ['--testPathPattern', '(?=.*(?:unit-of-work))'],
    })
  })

  it('should resolve the full-cycle tier with a pattern', () => {
    expect(buildJestArgs(['full-cycle', 'billing'])).toEqual({
      tier: 'full-cycle',
      args: ['--testPathPattern', '(?=.*(?:\\.full-cycle\\.test\\.))(?=.*(?:billing))'],
    })
  })

  it('should reject a forwarded test path pattern flag', () => {
    expect(() => buildJestArgs(['func', '--testPathPattern', 'x'])).toThrow('--testPathPattern')
  })

  it('should reject the equals form of the test path pattern flag', () => {
    expect(() => buildJestArgs(['func', '--testPathPattern=x'])).toThrow('--testPathPattern')
  })
})
