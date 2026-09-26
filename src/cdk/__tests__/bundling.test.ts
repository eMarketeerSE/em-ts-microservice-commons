import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { App, Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { resolveLambdaCode } from '../utils/bundling'

jest.mock('child_process', () => ({ execFileSync: jest.fn() }))

// Exercise real CDK staging with a controlled bundler. Content includes a shared
// dependency and the options, so invalidation is tested beyond the entry file.
describe('Lambda bundle asset identity', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'em-bundling-test-'))
    fs.mkdirSync(path.join(root, 'dist'))
    fs.writeFileSync(path.join(root, 'dist', 'handler-bundler.js'), '// controlled test bundler')
    jest.spyOn(process, 'cwd').mockReturnValue(root)
    jest.mocked(execFileSync).mockImplementation((_command, _args, options: any) => {
      const { entry, outDir, overrides } = JSON.parse(options.input)
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, 'index.js'), [
        fs.readFileSync(entry, 'utf8'),
        fs.readFileSync(path.join(path.dirname(entry), 'shared.txt'), 'utf8'),
        JSON.stringify(overrides ?? {}),
      ].join('\n'))
      return Buffer.alloc(0)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  function fixture(name: string): string {
    const dir = path.join(root, name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'a.ts'), 'handler A')
    fs.writeFileSync(path.join(dir, 'b.ts'), 'handler B')
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'shared dependency v1')
    return dir
  }

  function stack(): Stack {
    return new Stack(new App({ outdir: fs.mkdtempSync(path.join(root, 'assembly-')) }), 'Test')
  }

  function bind(scope: Stack, entryFile: string, minify = true) {
    const handler = new Construct(scope, `Handler${scope.node.children.length}`)
    const result = resolveLambdaCode({ entryFile, bundling: { minify } }).bind(handler)
    return result.s3Location!.objectKey
  }

  it('reuses identical output across fresh syntheses and checkout locations', () => {
    const first = fixture('checkout-one')
    const second = fixture('renamed-checkout')
    const key = bind(stack(), path.join(first, 'a.ts'))
    expect(bind(stack(), path.join(first, 'a.ts'))).toBe(key)
    expect(bind(stack(), path.join(second, 'a.ts'))).toBe(key)
  })

  it('builds different handlers in the same source directory independently', () => {
    const dir = fixture('project')
    const scope = stack()
    const first = bind(scope, path.join(dir, 'a.ts'))
    const second = bind(scope, path.join(dir, 'b.ts'))
    expect(second).not.toBe(first)
    expect(execFileSync).toHaveBeenCalledTimes(2)
  })

  it('distinguishes bundling options within the same assembly', () => {
    const dir = fixture('project')
    const scope = stack()
    expect(bind(scope, path.join(dir, 'a.ts'), false))
      .not.toBe(bind(scope, path.join(dir, 'a.ts'), true))
  })

  it('invalidates changed entry and shared dependency output', () => {
    const dir = fixture('project')
    const entry = path.join(dir, 'a.ts')
    const original = bind(stack(), entry)
    fs.writeFileSync(entry, 'changed handler')
    const changedEntry = bind(stack(), entry)
    expect(changedEntry).not.toBe(original)
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'shared dependency v2')
    expect(bind(stack(), entry)).not.toBe(changedEntry)
  })
})
