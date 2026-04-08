import * as path from 'path'
import * as esbuild from 'esbuild'
import * as fs from 'fs'

const { recapDevHandlerWrapper, defaultPlugins } = require('./esbuild-plugins')

const args = process.argv.slice(2)
const handlersDirIndex = args.indexOf('--handlers-dir')
const outDirIndex = args.indexOf('--out-dir')
const targetIndex = args.indexOf('--target')

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

const entryPoints = (fs.readdirSync(absoluteHandlersDir, { recursive: true } as any) as string[])
  .filter(
    f => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('.test.') && !f.includes('.spec.')
  )
  .map(f => ({
    in: path.join(absoluteHandlersDir, f),
    out: path.join(path.dirname(f), path.basename(f, '.ts'), 'index')
  }))

if (entryPoints.length === 0) {
  console.log(`No handlers found in ${handlersDir}`)
  process.exit(0)
}

console.log(`Building ${entryPoints.length} handler(s) from ${handlersDir}...`)

esbuild
  .build({
    entryPoints,
    outdir: absoluteOutDir,
    bundle: true,
    platform: 'node',
    target,
    format: 'cjs',
    sourcemap: false,
    minify: true,
    external: ['@aws-sdk/*'],
    plugins: [recapDevHandlerWrapper, ...defaultPlugins]
  })
  .then(() => {
    entryPoints.forEach(({ out }) => console.log(`  ${outDir}/${out}.js`))
  })
  .catch(err => {
    if (err?.errors?.length) {
      err.errors.forEach((e: any) => {
        const loc = e.location
          ? ` (${e.location.file}:${e.location.line}:${e.location.column})`
          : ''
        console.error(`  esbuild error${loc}: ${e.text}`)
      })
    } else {
      console.error(err)
    }
    process.exit(1)
  })
