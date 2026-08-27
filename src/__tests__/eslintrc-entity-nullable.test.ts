import { ESLint } from 'eslint'
import path from 'path'

const lintEntity = async (filePath: string, code: string): Promise<string[]> => {
  const eslint = new ESLint({
    cwd: path.resolve(__dirname, '../..'),
    useEslintrc: false,
    overrideConfigFile: path.resolve(__dirname, '../.eslintrc'),
  })
  const [result] = await eslint.lintText(code, { filePath })

  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax').map((message) => message.message)
}

describe('shared eslintrc: decorated optional properties on MikroORM entities', () => {
  const mysqlEntity = 'src/entities/mysql/thing.ts'

  it('should fail on a decorated `?: T` property', async () => {
    const messages = await lintEntity(mysqlEntity, [
      'export class Thing {',
      '  @Property({ nullable: true })',
      '  foo?: string',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([
      'A nullable column hydrates as null, never undefined — declare it `T | null = null`, not `?: T` (DV-4523).',
    ])
  })

  it('should fail on a decorated `?: T | null` property', async () => {
    const messages = await lintEntity(mysqlEntity, [
      'export class Thing {',
      '  @Property({ nullable: true })',
      '  foo?: string | null',
      '}',
      '',
    ].join('\n'))

    expect(messages).toHaveLength(1)
  })

  it('should pass on the `T | null = null` convention', async () => {
    const messages = await lintEntity(mysqlEntity, [
      'export class Thing {',
      '  @Property({ nullable: true })',
      '  foo: string | null = null',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should ignore optional properties without a decorator', async () => {
    const messages = await lintEntity(mysqlEntity, [
      'export class Thing {',
      '  plainOptional?: string',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should ignore the computed PrimaryKeyProp marker', async () => {
    const messages = await lintEntity(mysqlEntity, [
      "import { PrimaryKeyProp } from '@mikro-orm/core'",
      '',
      'export class Thing {',
      "  [PrimaryKeyProp]?: ['a', 'b']",
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })

  it('should leave files outside src/entities/mysql untouched', async () => {
    const messages = await lintEntity('src/entities/dynamo/thing.ts', [
      'export class Thing {',
      '  @attribute()',
      '  foo?: string',
      '}',
      '',
    ].join('\n'))

    expect(messages).toEqual([])
  })
})
