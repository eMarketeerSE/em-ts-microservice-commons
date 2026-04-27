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
 *   export { handler } and export { foo as handler } (the export *name* is
 *     `handler`; the negative lookahead excludes `handler as somethingElse`
 *     where `handler` is only the source identifier)
 *   module.exports.handler = ... / exports.handler = ... (CJS interop)
 *
 * Intentionally excludes `export default function handler` — the esbuild wrapper
 * accesses `unwrappedHandler.handler` (named export). Default exports compile to
 * `module.exports.default`, so `.handler` is `undefined` at runtime.
 *
 * Not covered: `export * from './impl'` — resolving re-exports would require
 * following the import graph. Files that match the source-naming convention
 * but contain no recognised pattern produce a `console.warn` from
 * `findEntryPoints`.
 */
const HANDLER_EXPORT_PATTERNS = [
  /export\s+(const|let|var|function|async\s+function)\s+handler\b/,
  /export\s*\{[^}]*\bhandler\b(?!\s*as\b)[^}]*\}/,
  /(?:module\.)?exports\.handler\s*=/,
]

function containsHandlerExport(content: string): boolean {
  return HANDLER_EXPORT_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Scans `handlersDir` recursively for TypeScript source files that export a
 * Lambda handler. Returns esbuild-compatible `{ in, out }` entry point pairs.
 *
 * `in` is the absolute file path. `out` is relative to `handlersDir`:
 * a file at `<handlersDir>/subdir/my-handler.ts` produces `out: 'subdir/my-handler/index'`.
 * esbuild combines this with its `outdir` to produce the final path.
 *
 * Files matching the handler-source naming convention but containing no handler
 * export (e.g. `export * from './impl'` re-exports, which cannot be detected
 * without resolving the import graph) emit a `console.warn` so the omission
 * surfaces in CI rather than being discovered at deploy time.
 *
 * Throws if a file cannot be read, with the full path included in the error message.
 */
export async function findEntryPoints(handlersDir: string): Promise<EntryPoint[]> {
  // Explicit { encoding: 'utf8' } selects the string[] overload of readdir
  // (the recursive overload otherwise has an ambiguous return type).
  const files = (await fs.promises.readdir(handlersDir, { recursive: true, encoding: 'utf8' })).filter(
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
        console.warn(
          `findEntryPoints: skipping ${fullPath} — no recognised handler export found. `
          + 'Supported shapes: export const/let/var/function handler, export { handler } / { foo as handler }, '
          + '(module.)exports.handler = …. Re-exports (export * from …) are not detected.'
        )
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
