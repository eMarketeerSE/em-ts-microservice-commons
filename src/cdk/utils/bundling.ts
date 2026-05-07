import * as path from 'path'
import * as fs from 'fs'
import { execFileSync } from 'child_process'
import { AssetHashType, DockerImage } from 'aws-cdk-lib'
import { Code } from 'aws-cdk-lib/aws-lambda'

/**
 * Per-handler esbuild overrides applied on top of the default bundler config
 * (Node 24, CJS, minified, externalised AWS SDK + DB drivers, recap.dev wrappers).
 *
 * `external` is appended to the default externals list. All other fields
 * replace their default. Plugins, entryPoints, outdir, bundle/platform/format
 * are not exposed — they are fixed by the bundler.
 */
export interface BundlingOverrides {
  readonly external?: string[]
  readonly target?: string | string[]
  readonly minify?: boolean
  readonly sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both'
  readonly define?: Record<string, string>
  readonly banner?: { js?: string; css?: string }
  readonly footer?: { js?: string; css?: string }
  readonly loader?: Record<string, string>
  readonly mainFields?: string[]
  readonly conditions?: string[]
  readonly keepNames?: boolean
  readonly treeShaking?: boolean
  readonly legalComments?: 'none' | 'inline' | 'eof' | 'linked' | 'external'
  readonly charset?: 'ascii' | 'utf8'
  readonly pure?: string[]
  /**
   * Packages copied verbatim from the consuming project's `node_modules/` into
   * the lambda asset directory (alongside the bundled `index.js`), and added to
   * the esbuild `external` list. Use for packages that can't be bundled because
   * they perform `require.resolve()` against their own files at runtime
   * (`playwright-core`, `puppeteer-core`, `sharp`, etc.).
   *
   * Each listed package is resolved from the consuming project's CWD. Its
   * declared `dependencies` are walked transitively and copied as well.
   * `peerDependencies` and `optionalDependencies` are NOT auto-included — list
   * them explicitly if needed.
   *
   * Symlinked packages (yarn workspaces, pnpm) are dereferenced so the lambda
   * zip contains real files. Native binaries are NOT recompiled — packages with
   * prebuilds must already match the lambda's runtime architecture.
   */
  readonly nodeModules?: string[]
}

export interface ResolveLambdaCodeOptions {
  /**
   * Source TS entry file (e.g. `src/handlers/foo.ts`).
   * Required when `codePath` is not provided.
   */
  readonly entryFile?: string
  /**
   * Pre-built directory passed straight to `Code.fromAsset` — bundling is skipped.
   * Use for migration or test scenarios where the code is already built.
   */
  readonly codePath?: string
  readonly bundling?: BundlingOverrides
}

const HANDLER_BUNDLER_RELATIVE_PATH = path.join('dist', 'handler-bundler.js')
const PACKAGE_NAME = '@emarketeer/ts-microservice-commons'

let cachedBundlerPath: string | undefined

function getHandlerBundlerPath(): string {
  if (cachedBundlerPath) {
    return cachedBundlerPath
  }
  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'node_modules', PACKAGE_NAME, HANDLER_BUNDLER_RELATIVE_PATH),
    path.join(cwd, HANDLER_BUNDLER_RELATIVE_PATH)
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedBundlerPath = candidate
      return candidate
    }
  }
  throw new Error(
    `Could not locate the handler bundler. Searched:\n${candidates.map((c) => `  - ${c}`).join('\n')}\n`
      + `Ensure ${PACKAGE_NAME} is installed.`
  )
}

/**
 * Build the `Code` asset for a Lambda function.
 *
 * - When `codePath` is set, packages that directory directly (no bundling).
 * - Otherwise bundles `entryFile` via the project handler bundler at synth
 *   time, with overrides applied on top of the defaults.
 *
 * Bundling uses `assetHashType: OUTPUT` so the asset hash is computed from
 * the bundled output rather than from the (transitive) source tree.
 */
export function resolveLambdaCode(options: ResolveLambdaCodeOptions): Code {
  if (options.codePath) {
    return Code.fromAsset(options.codePath)
  }
  if (!options.entryFile) {
    throw new Error('resolveLambdaCode: either `entryFile` or `codePath` is required.')
  }

  const entry = path.resolve(options.entryFile)
  if (!fs.existsSync(entry)) {
    throw new Error(`resolveLambdaCode: entry file not found: ${entry}`)
  }
  const overrides = options.bundling
  const bundlerPath = getHandlerBundlerPath()

  return Code.fromAsset(path.dirname(entry), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: {
      // CDK requires `image` even when local bundling succeeds. We never use
      // the Docker fallback — `tryBundle` always returns true.
      image: DockerImage.fromRegistry('node:24'),
      local: {
        tryBundle(outputDir: string): boolean {
          const stdin = JSON.stringify({ entry, outDir: outputDir, overrides })
          execFileSync('node', [bundlerPath], {
            input: stdin,
            stdio: ['pipe', 'inherit', 'inherit']
          })
          return true
        }
      }
    }
  })
}
