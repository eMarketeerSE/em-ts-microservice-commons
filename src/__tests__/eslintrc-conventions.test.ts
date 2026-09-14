import { ESLint } from 'eslint'
import path from 'path'

const EACH_MESSAGE =
  'Parametrized tests are not allowed. Write a separate it() block per case with inline assertions.'
const ERROR_SUBTYPE_MESSAGE =
  'Do not subclass Error. Throw a plain Error and put any distinguishing data in a property on it.'
const TEST_NAME_MESSAGE =
  'Test files are named *.unit.test.ts, *.func.test.ts, *.full-cycle.test.ts or *.so.test.ts, '
  + 'so em-commons jest runs them in the right tier.'

const lint = async (filePath: string, code: string): Promise<string[]> => {
  const eslint = new ESLint({
    cwd: path.resolve(__dirname, '../..'),
    useEslintrc: false,
    overrideConfigFile: path.resolve(__dirname, '../.eslintrc'),
  })
  const [result] = await eslint.lintText(code, { filePath })

  return result.messages.map((message) => `${message.ruleId}: ${message.message}`)
}

describe('shared eslintrc: no parametrized tests', () => {
  const testFile = 'src/services/thing.unit.test.ts'

  it('should fail on it.each with an array', async () => {
    const messages = await lint(testFile, [
      "it.each([1, 2])('should handle %s', (value) => {",
      '  expect(value).toBeDefined()',
      '})',
      '',
    ].join('\n'))

    expect(messages).toEqual([`no-restricted-syntax: ${EACH_MESSAGE}`])
  })

  it('should fail on describe.each', async () => {
    const messages = await lint(testFile, [
      "describe.each([1, 2])('thing %s', (value) => {",
      "  it('should work', () => {",
      '    expect(value).toBeDefined()',
      '  })',
      '})',
      '',
    ].join('\n'))

    expect(messages).toEqual([`no-restricted-syntax: ${EACH_MESSAGE}`])
  })

  it('should fail on test.each as a tagged template', async () => {
    const messages = await lint(testFile, [
      'test.each`',
      '  a    | expected',
      '  ${1} | ${1}',
      "`('should handle $a', ({ a, expected }) => {",
      '  expect(a).toBe(expected)',
      '})',
      '',
    ].join('\n'))

    expect(messages).toEqual([`no-restricted-syntax: ${EACH_MESSAGE}`])
  })

  it('should fail on it.only.each', async () => {
    const messages = await lint(testFile, [
      "it.only.each([1])('should handle %s', (value) => {",
      '  expect(value).toBeDefined()',
      '})',
      '',
    ].join('\n'))

    expect(messages).toEqual([`no-restricted-syntax: ${EACH_MESSAGE}`])
  })

  it('should pass on separate it() blocks', async () => {
    const messages = await lint(testFile, [
      "describe('thing', () => {",
      "  it('should handle one', () => {",
      '    expect(1).toBe(1)',
      '  })',
      '',
      "  it('should handle two', () => {",
      '    expect(2).toBe(2)',
      '  })',
      '})',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})

describe('shared eslintrc: no Error subtypes', () => {
  const serviceFile = 'src/services/thing-service.ts'

  it('should fail on a class extending Error', async () => {
    const messages = await lint(serviceFile, [
      'export class NotFoundError extends Error {}',
      '',
    ].join('\n'))

    expect(messages).toEqual([`no-restricted-syntax: ${ERROR_SUBTYPE_MESSAGE}`])
  })

  it('should fail on a class extending another Error subtype', async () => {
    const messages = await lint(serviceFile, [
      "import { AssertionError } from 'assert'",
      '',
      'export class NotFoundError extends AssertionError {}',
      '',
    ].join('\n'))

    expect(messages).toEqual([`no-restricted-syntax: ${ERROR_SUBTYPE_MESSAGE}`])
  })

  it('should pass on a plain Error with a property', async () => {
    const messages = await lint(serviceFile, [
      'export const notFound = (id: string): Error => {',
      '  const error = new Error(`Thing ${id} not found`)',
      "  Object.assign(error, { code: 'NOT_FOUND' })",
      '',
      '  return error',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})

describe('shared eslintrc: eslint-disable needs a reason', () => {
  const serviceFile = 'src/services/thing-service.ts'

  it('should fail on a disable comment without a description', async () => {
    const messages = await lint(serviceFile, [
      '// eslint-disable-next-line no-console',
      "console.log('x')",
      '',
    ].join('\n'))

    expect(messages).toEqual([
      'eslint-comments/require-description: Unexpected undescribed directive comment. '
      + 'Include descriptions to explain why the comment is necessary.',
    ])
  })

  it('should pass on a disable comment with a description', async () => {
    const messages = await lint(serviceFile, [
      '// eslint-disable-next-line no-console -- the vendor CLI reads stdout',
      "console.log('x')",
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})

describe('shared eslintrc: interfaces over type aliases', () => {
  const modelFile = 'src/models/thing.ts'

  it('should fail on an object type alias', async () => {
    const messages = await lint(modelFile, [
      'export type Thing = {',
      '  id: string',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([
      '@typescript-eslint/consistent-type-definitions: Use an `interface` instead of a `type`.',
    ])
  })

  it('should pass on an interface', async () => {
    const messages = await lint(modelFile, [
      'export interface Thing {',
      '  id: string',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should pass on a union type alias, which an interface cannot express', async () => {
    const messages = await lint(modelFile, [
      "export type Stage = 'dev' | 'prod'",
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})

describe('shared eslintrc: named exports only', () => {
  it('should fail on a default export in a service', async () => {
    const messages = await lint('src/services/thing-service.ts', [
      'export default class ThingService {}',
      '',
    ].join('\n'))

    expect(messages).toEqual(['import/no-default-export: Prefer named exports.'])
  })

  it('should fail on a default export in a handler', async () => {
    const messages = await lint('src/handlers/do-thing.ts', [
      'export default async (): Promise<void> => {',
      '  await Promise.resolve()',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual(['import/no-default-export: Prefer named exports.'])
  })

  it('should allow the default export MikroORM requires in a migration', async () => {
    const messages = await lint('src/db/migrations/20260914120000_add_thing.ts', [
      'export default class Migration20260914120000AddThing {',
      '  public up(): Promise<void> {',
      '    return Promise.resolve()',
      '  }',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should allow the default export in a migration under src/migrations', async () => {
    const messages = await lint('src/migrations/20260914120000_add_thing.ts', [
      'export default class Migration20260914120000AddThing {',
      '  public up(): Promise<void> {',
      '    return Promise.resolve()',
      '  }',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should allow the default export jest requires in the func-test setup', async () => {
    const messages = await lint('src/utils/func-test-setup.ts', [
      'export default async (): Promise<void> => {',
      '  await Promise.resolve()',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should allow the default export jest requires in the func-test teardown', async () => {
    const messages = await lint('src/utils/func-test-teardown.ts', [
      'export default async (): Promise<void> => {',
      '  await Promise.resolve()',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})

describe('shared eslintrc: max line length is an error', () => {
  it('should fail on a line longer than 120 characters', async () => {
    const messages = await lint('src/services/thing-service.ts', [
      `export const thing = '${'a'.repeat(100)}'`,
      '',
    ].join('\n'))

    expect(messages).toEqual(['max-len: This line has a length of 123. Maximum allowed is 120.'])
  })

  it('should pass on a 120 character line', async () => {
    const messages = await lint('src/services/thing-service.ts', [
      `export const thing = '${'a'.repeat(96)}'`,
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})

describe('shared eslintrc: test files carry a tier suffix', () => {
  const emptySuite = [
    "describe('thing', () => {",
    "  it('should work', () => {",
    '    expect(1).toBe(1)',
    '  })',
    '})',
    '',
  ].join('\n')

  it('should fail on a test file without a tier suffix', async () => {
    const messages = await lint('src/services/thing-service.test.ts', emptySuite)

    expect(messages).toEqual([`no-restricted-syntax: ${TEST_NAME_MESSAGE}`])
  })

  it('should fail on a spec file', async () => {
    const messages = await lint('src/services/thing-service.spec.ts', emptySuite)

    expect(messages).toEqual([`no-restricted-syntax: ${TEST_NAME_MESSAGE}`])
  })

  it('should pass on a unit test', async () => {
    expect(await lint('src/services/thing-service.unit.test.ts', emptySuite)).toEqual([])
  })

  it('should pass on a func test', async () => {
    expect(await lint('src/services/thing-service.func.test.ts', emptySuite)).toEqual([])
  })

  it('should pass on a full-cycle test', async () => {
    expect(await lint('src/services/thing-service.full-cycle.test.ts', emptySuite)).toEqual([])
  })

  it('should pass on a SuperOffice test', async () => {
    expect(await lint('src/services/thing-service.so.test.ts', emptySuite)).toEqual([])
  })

  it('should pass on a test file nested in a tests directory', async () => {
    expect(await lint('src/services/thing-service-tests/thing.unit.test.ts', emptySuite)).toEqual([])
  })
})
