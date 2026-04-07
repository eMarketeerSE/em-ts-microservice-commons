'use strict'

const path = require('path')
const esbuild = require('esbuild')
const fs = require('fs')
const plugins = require('./esbuild-plugins')

const { recapDevHandlerWrapper } = plugins

const args = process.argv.slice(2)
const handlersDirIndex = args.indexOf('--handlers-dir')
const outDirIndex = args.indexOf('--out-dir')

const handlersDir = handlersDirIndex !== -1 ? args[handlersDirIndex + 1] : 'src/handlers'
const outDir = outDirIndex !== -1 ? args[outDirIndex + 1] : 'dist/handlers'

const rootDir = process.cwd()
const absoluteHandlersDir = path.join(rootDir, handlersDir)

if (!fs.existsSync(absoluteHandlersDir)) {
  console.error(`Handlers directory not found: ${absoluteHandlersDir}`)
  process.exit(1)
}

const entryPoints = fs.readdirSync(absoluteHandlersDir, { recursive: true })
  .filter((f) =>
    f.endsWith('.ts') &&
    !f.endsWith('.d.ts') &&
    !f.includes('.test.') &&
    !f.includes('.spec.') &&
    !f.includes('.func.test.')
  )
  .map((f) => ({
    in: path.join(absoluteHandlersDir, f),
    out: path.join(path.dirname(f), path.basename(f, '.ts'), 'index'),
  }))

if (entryPoints.length === 0) {
  console.log(`No handlers found in ${handlersDir}`)
  process.exit(0)
}

console.log(`Building ${entryPoints.length} handler(s) from ${handlersDir}...`)

esbuild.build({
  entryPoints,
  outdir: path.join(rootDir, outDir),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  minify: true,
  external: ['@aws-sdk/*'],
  plugins: [recapDevHandlerWrapper, ...plugins],
}).then(() => {
  entryPoints.forEach(({ out }) => console.log(`  ${outDir}/${out}.js`))
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
