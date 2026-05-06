import * as path from 'path'
import * as esbuild from 'esbuild'
import * as fs from 'fs'
import { findEntryPoints } from './find-entry-points'

const { recapDevHandlerWrapper, defaultPlugins } = require('./esbuild-plugins')

const args = process.argv.slice(2)
const handlersDirIndex = args.indexOf('--handlers-dir')
const outDirIndex = args.indexOf('--out-dir')
const targetIndex = args.indexOf('--target')
// --allow-empty: exit 0 instead of 1 when no handlers are found. Used by
// services that may legitimately have zero Lambda handlers (libraries,
// infra-only packages) so a shared `em-commons build-handlers` step can be
// run unconditionally in their CI without breaking the pipeline.
const allowEmpty = args.includes('--allow-empty')

function resolveArg(index: number, flag: string, fallback: string): string {
  if (index === -1) {
    return fallback
  }
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    console.error(`${flag} requires a value`)
    process.exit(1)
  }
  return value
}

const handlersDir = resolveArg(handlersDirIndex, '--handlers-dir', 'src/handlers')
const outDir = resolveArg(outDirIndex, '--out-dir', 'dist/handlers')
const target = resolveArg(targetIndex, '--target', 'node24')

const rootDir = process.cwd()
const absoluteHandlersDir = path.resolve(rootDir, handlersDir)
const absoluteOutDir = path.resolve(rootDir, outDir)

if (!absoluteHandlersDir.startsWith(rootDir + path.sep)) {
  console.error(`--handlers-dir must be inside the project root: ${absoluteHandlersDir}`)
  process.exit(1)
}

if (!absoluteOutDir.startsWith(rootDir + path.sep)) {
  console.error(`--out-dir must be inside the project root: ${absoluteOutDir}`)
  process.exit(1)
}

if (!fs.existsSync(absoluteHandlersDir)) {
  console.error(`Handlers directory not found: ${absoluteHandlersDir}`)
  process.exit(1)
}

// Packages that some services use and others don't. When a consuming service
// declares them in package.json we bundle them; otherwise we mark them external
// so esbuild doesn't fail trying to resolve a transitive import that will never
// run. Extend this list as new conditional deps surface.
const optionalDependencies: string[] = ['chromium-bidi']

function resolveExternalOptionalDeps(): string[] {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
  const deps = pkg.dependencies ?? {}
  return optionalDependencies.filter(dep => !(dep in deps))
}

async function main(): Promise<void> {
  const entryPoints = await findEntryPoints(absoluteHandlersDir)

  if (entryPoints.length === 0) {
    if (allowEmpty) {
      // Log the resolved absolute path so a misrouted --handlers-dir (typo'd
      // to a real-but-empty sibling directory) is visible in CI output.
      console.warn(
        `No handlers found in ${handlersDir} (resolved: ${absoluteHandlersDir}), ` +
          'skipping build (--allow-empty)'
      )
      return
    }
    console.error(`No handlers found in ${handlersDir}. Pass --allow-empty to suppress this error.`)
    process.exit(1)
  }

  console.log(`Building ${entryPoints.length} handler(s) from ${handlersDir}...`)

  await esbuild.build({
    entryPoints,
    outdir: absoluteOutDir,
    bundle: true,
    platform: 'node',
    target,
    format: 'cjs',
    sourcemap: false,
    minify: true,
    external: [
      '@aws-sdk/*',
      'aws-sdk',
      // Unused Knex/DB drivers — matches serverless-esbuild external list
      'mysql',
      'pg',
      'pg-native',
      'sqlite3',
      'mssql',
      'oracledb',
      'better-sqlite3',
      'pg-sqlite3',
      'tedious',
      'pg-query-stream',
      'libsql',
      'mariadb',
      ...resolveExternalOptionalDeps()
    ],
    plugins: [recapDevHandlerWrapper, ...defaultPlugins]
  })

  entryPoints.forEach(({ out }) => console.log(`  ${outDir}/${out}.js`))
}

main().catch(err => {
  if (err?.errors?.length) {
    err.errors.forEach(
      (e: { text?: string; location?: { file: string; line: number; column: number } }) => {
        const loc = e.location
          ? ` (${e.location.file}:${e.location.line}:${e.location.column})`
          : ''
        console.error(`  esbuild error${loc}: ${e.text}`)
      }
    )
  } else {
    // Print the full stack (and `cause` chain) so non-esbuild errors are
    // diagnosable in CI output rather than being collapsed to the message.
    console.error(err instanceof Error ? err.stack ?? err : err)
  }
  process.exit(1)
})
