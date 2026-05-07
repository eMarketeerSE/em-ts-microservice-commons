import * as path from 'path'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as esbuild from 'esbuild'
import esbuildPluginTsc from '@emarketeer/esbuild-plugin-tsc'

interface BundlingOverrides {
  external?: string[]
  target?: string | string[]
  minify?: boolean
  sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both'
  define?: Record<string, string>
  banner?: { js?: string; css?: string }
  footer?: { js?: string; css?: string }
  loader?: Record<string, esbuild.Loader>
  mainFields?: string[]
  conditions?: string[]
  keepNames?: boolean
  treeShaking?: boolean
  legalComments?: 'none' | 'inline' | 'eof' | 'linked' | 'external'
  charset?: 'ascii' | 'utf8'
  pure?: string[]
  nodeModules?: string[]
}

interface BundlerInput {
  entry: string
  outDir: string
  overrides?: BundlingOverrides
}

const DEFAULT_TARGET = 'node24'

const DEFAULT_EXTERNALS: string[] = [
  '@aws-sdk/*',
  'aws-sdk',
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
]

const OPTIONAL_DEPENDENCIES: string[] = ['chromium-bidi']

function resolveOptionalExternals(): string[] {
  const pkgPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return OPTIONAL_DEPENDENCIES
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const deps: Record<string, string> = pkg.dependencies ?? {}
  return OPTIONAL_DEPENDENCIES.filter((dep) => !(dep in deps))
}

function copyNodeModulesIntoAsset(roots: string[], outDir: string): void {
  // Resolve from the consuming project's cwd to honour pnpm / non-hoisted layouts.
  const projectRequire = createRequire(path.join(process.cwd(), 'package.json'))
  const seen = new Set<string>()
  const queue = [...roots]

  while (queue.length) {
    const pkg = queue.shift()!
    if (seen.has(pkg)) {
      // eslint-disable-next-line no-continue
      continue
    }
    seen.add(pkg)

    let pkgJsonPath: string
    try {
      pkgJsonPath = projectRequire.resolve(`${pkg}/package.json`)
    } catch {
      throw new Error(
        `bundling.nodeModules: cannot resolve "${pkg}" from ${process.cwd()}. `
          + 'Ensure it is installed in the consuming project\'s dependencies.',
      )
    }

    const pkgDir = path.dirname(pkgJsonPath)
    const dest = path.join(outDir, 'node_modules', pkg)
    fs.cpSync(pkgDir, dest, { recursive: true, dereference: true })

    const meta = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    for (const dep of Object.keys(meta.dependencies ?? {})) {
      queue.push(dep)
    }
  }
}

const recapDevHandlerWrapper: esbuild.Plugin = {
  name: 'recap-dev-handler-wrapper',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind !== 'entry-point') {
        return null
      }
      return {
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'recap-dev-wrapper',
      }
    })

    build.onLoad({ filter: /.*/, namespace: 'recap-dev-wrapper' }, (args) => {
      const originalFile = `./${path.basename(args.path, path.extname(args.path))}`
      return {
        contents: [
          'import { wrapLambdaHandler } from \'@recap.dev/client\'',
          `import * as unwrappedHandler from '${originalFile}'`,
          'export const handler = wrapLambdaHandler(unwrappedHandler.handler)',
        ].join('\n'),
        loader: 'ts',
        resolveDir: path.dirname(args.path),
      }
    })
  },
}

const recapDevAutoWrapper: esbuild.Plugin = {
  name: 'recap-dev-auto-wrapper',
  setup(build) {
    build.onLoad({ filter: /mysql2\/index\.js/ }, ({ path: filePath }) => {
      const originalSource = fs.readFileSync(filePath, 'utf8')
      return {
        resolveDir: path.dirname(filePath),
        contents: `
          (function() {
    ${originalSource}
  })(...arguments);
  {
  let mod = module.exports;
  const { mysqlQueryWrapper } = require('@recap.dev/client')

  if (mod && mod.Connection && mod.Connection.prototype) {
    mod.Connection.prototype.query = mysqlQueryWrapper(mod.Connection.prototype.query);
    mod.Connection.prototype.execute = mysqlQueryWrapper(mod.Connection.prototype.execute);
  }
  module.exports = mod;
  }
  `,
      }
    })
  },
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function main(): Promise<void> {
  const raw = await readStdin()
  if (!raw.trim()) {
    throw new Error('handler-bundler: stdin is empty; expected JSON { entry, outDir, overrides? }')
  }
  const input: BundlerInput = JSON.parse(raw)
  if (!input.entry || !input.outDir) {
    throw new Error('handler-bundler: stdin JSON must include `entry` and `outDir`.')
  }

  const overrides = input.overrides ?? {}

  await esbuild.build({
    entryPoints: [input.entry],
    outfile: path.join(input.outDir, 'index.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: overrides.target ?? DEFAULT_TARGET,
    minify: overrides.minify ?? true,
    sourcemap: overrides.sourcemap ?? false,
    external: [
      ...DEFAULT_EXTERNALS,
      ...resolveOptionalExternals(),
      ...(overrides.external ?? []),
      ...(overrides.nodeModules ?? []),
    ],
    define: overrides.define,
    banner: overrides.banner,
    footer: overrides.footer,
    loader: overrides.loader,
    mainFields: overrides.mainFields,
    conditions: overrides.conditions,
    keepNames: overrides.keepNames,
    treeShaking: overrides.treeShaking,
    legalComments: overrides.legalComments,
    charset: overrides.charset,
    pure: overrides.pure,
    plugins: [recapDevHandlerWrapper, recapDevAutoWrapper, esbuildPluginTsc()],
  })

  if (overrides.nodeModules?.length) {
    copyNodeModulesIntoAsset(overrides.nodeModules, input.outDir)
  }
}

main().catch((err) => {
  if (err?.errors?.length) {
    err.errors.forEach(
      (e: { text?: string; location?: { file: string; line: number; column: number } }) => {
        const loc = e.location
          ? ` (${e.location.file}:${e.location.line}:${e.location.column})`
          : ''
        console.error(`  esbuild error${loc}: ${e.text}`)
      },
    )
  } else {
    console.error(err instanceof Error ? err.stack ?? err : err)
  }
  process.exit(1)
})
