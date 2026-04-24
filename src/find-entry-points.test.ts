import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { findEntryPoints } from './find-entry-points'

describe('findEntryPoints', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-entry-points-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function write(relPath: string, content: string): void {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content)
  }

  describe('handler export detection', () => {
    it('includes export const handler', async () => {
      write('h.ts', 'export const handler = async () => {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(1)
    })

    it('includes export let handler', async () => {
      write('h.ts', 'export let handler = async () => {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(1)
    })

    it('includes export function handler', async () => {
      write('h.ts', 'export function handler() {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(1)
    })

    it('includes export async function handler', async () => {
      write('h.ts', 'export async function handler() {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(1)
    })

    it('includes export { handler }', async () => {
      write('h.ts', 'const h = () => {}\nexport { h as handler }')
      expect(await findEntryPoints(tmpDir)).toHaveLength(1)
    })

    it('includes module.exports.handler (CJS interop)', async () => {
      write('h.ts', 'module.exports.handler = async () => {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(1)
    })

    it('excludes export default function handler — wrapper accesses .handler not .default', async () => {
      write('h.ts', 'export default function handler() {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })

    it('excludes export { handler as otherName } — handler is not the exported binding', async () => {
      write('h.ts', 'const handler = () => {}\nexport { handler as processEvent }')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })

    it('excludes files with no handler export', async () => {
      write('utils.ts', 'export function doSomething() {}\nexport const foo = 1')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })
  })

  describe('file exclusion', () => {
    it('excludes .test.ts files', async () => {
      write('h.test.ts', 'export const handler = async () => {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })

    it('excludes .spec.ts files', async () => {
      write('h.spec.ts', 'export const handler = async () => {}')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })

    it('excludes .d.ts declaration files', async () => {
      write('h.d.ts', 'export declare const handler: () => void')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })
  })

  describe('output path derivation', () => {
    it('maps top-level file to <name>/index', async () => {
      write('my-handler.ts', 'export const handler = async () => {}')
      const [entry] = await findEntryPoints(tmpDir)
      expect(entry.out).toBe(path.join('my-handler', 'index'))
    })

    it('maps nested file to <dir>/<name>/index', async () => {
      write('subdir/my-handler.ts', 'export const handler = async () => {}')
      const [entry] = await findEntryPoints(tmpDir)
      expect(entry.out).toBe(path.join('subdir', 'my-handler', 'index'))
    })

    it('sets `in` to the absolute file path', async () => {
      write('my-handler.ts', 'export const handler = async () => {}')
      const [entry] = await findEntryPoints(tmpDir)
      expect(entry.in).toBe(path.join(tmpDir, 'my-handler.ts'))
    })
  })

  describe('edge cases', () => {
    it('returns empty array when directory is empty', async () => {
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })

    it('returns empty array when no files have handler exports', async () => {
      write('a.ts', 'export const foo = 1')
      write('b.ts', 'export const bar = 2')
      expect(await findEntryPoints(tmpDir)).toHaveLength(0)
    })

    it('handles multiple handlers across nested directories', async () => {
      write('a/handler-a.ts', 'export const handler = async () => {}')
      write('b/handler-b.ts', 'export async function handler() {}')
      write('shared/utils.ts', 'export const helper = () => {}')
      const entries = await findEntryPoints(tmpDir)
      expect(entries).toHaveLength(2)
      const outs = entries.map(e => e.out).sort()
      expect(outs).toEqual([path.join('a', 'handler-a', 'index'), path.join('b', 'handler-b', 'index')])
    })

    it('throws with file path when a file cannot be read', async () => {
      write('bad.ts', 'export const handler = async () => {}')
      const fullPath = path.join(tmpDir, 'bad.ts')
      const spy = jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      )
      await expect(findEntryPoints(tmpDir)).rejects.toThrow(fullPath)
      spy.mockRestore()
    })
  })
})
