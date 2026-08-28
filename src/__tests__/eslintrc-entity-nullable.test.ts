import { ESLint } from 'eslint'
import path from 'path'

const NULLABLE_MESSAGE =
  'This column is nullable, so the property type has to include null. ' +
  'Write `T | null`, not `?: T` and not plain `T` (DV-4523).'

const lintEntity = async (filePath: string, members: string[]): Promise<string[]> => {
  const eslint = new ESLint({
    cwd: path.resolve(__dirname, '../..'),
    useEslintrc: false,
    overrideConfigFile: path.resolve(__dirname, '../.eslintrc'),
  })
  const code = ['export class Thing {', ...members, '}', ''].join('\n')
  const [result] = await eslint.lintText(code, { filePath })

  return result.messages
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message)
}

describe('shared eslintrc: nullable columns must include null in the property type', () => {
  const entity = 'src/entities/thing.ts'

  it('should fail on `?: T` over a nullable column', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo?: string',
    ])

    expect(messages).toEqual([NULLABLE_MESSAGE])
  })

  it('should fail on plain `T` over a nullable column', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo: string',
    ])

    expect(messages).toEqual([NULLABLE_MESSAGE])
  })

  it('should fail on `!: T` over a nullable column', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo!: string',
    ])

    expect(messages).toEqual([NULLABLE_MESSAGE])
  })

  it('should fail on `T | undefined` over a nullable column', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo: string | undefined',
    ])

    expect(messages).toEqual([NULLABLE_MESSAGE])
  })

  it('should pass on the `T | null = null` convention', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo: string | null = null',
    ])

    expect(messages).toEqual([])
  })

  it('should pass on `?: T | null`, which already reads as null', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo?: string | null',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore an optional property over a NOT NULL column', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string' })",
      '  public foo?: string',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore an optional property over `nullable: false`', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: false })",
      '  public foo?: string',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore a property that is not a column', async () => {
    const messages = await lintEntity(entity, [
      '  @Property({ persist: false })',
      '  public computed?: number',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore a nullable relation, which is absent when unjoined', async () => {
    const messages = await lintEntity(entity, [
      '  @ManyToOne(() => Session, (session) => session.pageViews, { nullable: true })',
      "  @JoinColumn({ name: 'session_id' })",
      '  public session?: Session',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore a nullable one-to-many relation', async () => {
    const messages = await lintEntity(entity, [
      '  @OneToMany(() => Other, (other) => other.thing, { nullable: true })',
      '  public others?: Other[]',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore an optional request DTO field', async () => {
    const messages = await lintEntity('src/handlers/do-thing/do-thing.ts', [
      '  @IsOptional()',
      '  @IsString()',
      '  public foo?: string',
    ])

    expect(messages).toEqual([])
  })

  it('should ignore the computed PrimaryKeyProp marker', async () => {
    const messages = await lintEntity(entity, [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo: string | null = null',
      '',
      "  [PrimaryKeyProp]?: ['tenantId', 'foo']",
    ])

    expect(messages).toEqual([])
  })

  it('should catch a nullable column in an entity nested below src/entities', async () => {
    const messages = await lintEntity('src/entities/mysql/nested/thing.ts', [
      "  @Property({ name: 'foo', type: 'string', nullable: true })",
      '  public foo?: string',
    ])

    expect(messages).toEqual([NULLABLE_MESSAGE])
  })

  it('should catch a nullable TypeORM column', async () => {
    const messages = await lintEntity(entity, [
      "  @Column({ name: 'utm_source', type: 'varchar', nullable: true })",
      '  public utmSource?: string',
    ])

    expect(messages).toEqual([NULLABLE_MESSAGE])
  })
})
