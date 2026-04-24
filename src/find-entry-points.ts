import * as path from 'path'
import * as fs from 'fs'

export interface EntryPoint {
  readonly in: string
  readonly out: string
}

/**
 * Patterns that indicate a file exports a Lambda handler named `handler`.
 *
 * Covers:
 *   export const/let/var handler = ...
 *   export function handler / export async function handler
 *   export { handler } / export { foo as handler }
 *   module.exports.handler = ... (CJS interop)
 *
 * Intentionally excludes `export default function handler` — the esbuild wrapper
 * accesses `unwrappedHandler.handler` (named export). Default exports compile to
 * `module.exports.default`, so `.handler` is `undefined` at runtime.
 *
 * Not covered: `export * from './impl'` — resolving re-exports would require
 * following the import graph, which is outside the scope of this filter.
 */
const HANDLER_EXPORT_PATTERNS = [
  /export\s+(const|let|var|function|async\s+function)\s+handler\b/,
  /export\s*\{[^}]*\bhandler\b(?!\s*as\b)[^}]*\}/,
  /module\.exports\.handler\s*=/,
]

function containsHandlerExport(content: string): boolean {
  return HANDLER_EXPORT_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Scans `handlersDir` recursively for TypeScript source files that export a
 * Lambda handler. Returns esbuild-compatible `{ in, out }` entry point pairs.
 *
 * Each matching file `<dir>/<name>.ts` maps to output
 * `<dir>/<name>/index` so the Lambda code path becomes `dist/handlers/<dir>/<name>/index.js`.
 *
 * Throws if a file cannot be read, with the full path included in the error message.
 */
export async function findEntryPoints(handlersDir: string): Promise<EntryPoint[]> {
  const files = (fs.readdirSync(handlersDir, { recursive: true } as any) as string[]).filter(
    f => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('.test.') && !f.includes('.spec.')
  )

  const results = await Promise.all(
    files.map(async f => {
      const fullPath = path.join(handlersDir, f)
      let content: string
      try {
        content = await fs.promises.readFile(fullPath, 'utf8')
      } catch (err) {
        throw new Error(`findEntryPoints: could not read ${fullPath}: ${(err as NodeJS.ErrnoException).message}`)
      }
      if (!containsHandlerExport(content)) {
        return undefined
      }
      return {
        in: fullPath,
        out: path.join(path.dirname(f), path.basename(f, '.ts'), 'index'),
      }
    })
  )

  return results.filter((entry): entry is EntryPoint => entry !== undefined)
}
