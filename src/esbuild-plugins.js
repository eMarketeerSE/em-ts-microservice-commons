const esbuildPluginTsc = require('@emarketeer/esbuild-plugin-tsc')
const fs = require('fs')
const path = require('path')
const { dirname } = path

const recapDevAutoWrapper = {
  name: 'recap-dev-auto-wrapper',
  setup(build) {
    build.onLoad({ filter: /mysql2\/index.js/ }, async ({ path }) => {
      const originalSource = fs.readFileSync(path, 'utf8')

      return ({
        resolveDir: dirname(path),
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
      })
    })
  },
}

/**
 * Mirrors what @recap.dev/serverless-plugin does at package time:
 * intercepts each Lambda entry point and returns a synthetic wrapper module
 * that imports the original handler and wraps it with wrapLambdaHandler.
 *
 * Handler source files stay completely untouched — the wrapping is injected
 * at build time without modifying source. Include this plugin first in the
 * esbuild plugins array so it intercepts entry points before other plugins run.
 *
 * Usage in build script:
 *   const { recapDevHandlerWrapper } = require('@emarketeer/ts-microservice-commons/esbuild-plugins')
 *   plugins: [recapDevHandlerWrapper, ...otherPlugins]
 */
const recapDevHandlerWrapper = {
  name: 'recap-dev-handler-wrapper',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind !== 'entry-point') return
      return {
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'recap-dev-wrapper',
      }
    })

    build.onLoad({ filter: /.*/, namespace: 'recap-dev-wrapper' }, (args) => {
      const originalFile = './' + path.basename(args.path, path.extname(args.path))
      return {
        contents: [
          `import { wrapLambdaHandler } from '@recap.dev/client'`,
          `import * as unwrappedHandler from '${originalFile}'`,
          `export const handler = wrapLambdaHandler(unwrappedHandler.handler)`,
        ].join('\n'),
        loader: 'ts',
        resolveDir: path.dirname(args.path),
      }
    })
  },
}

/**
 * esbuild-plugin-tsc wrapper that forces "module": "CommonJS".
 *
 * The service tsconfig uses "module": "NodeNext" which causes the tsc
 * plugin to emit ESM helpers that esbuild then converts to CJS — double
 * conversion adds ~2MB per bundle. This wrapper writes a temporary
 * tsconfig that extends the service's config with module: CommonJS.
 */
const esbuildPluginTscCjs = () => {
  const tmpConfig = path.join(process.cwd(), 'tsconfig.esbuild-tmp.json')
  const baseConfig = path.join(process.cwd(), 'tsconfig.json')

  if (fs.existsSync(baseConfig)) {
    fs.writeFileSync(tmpConfig, JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { module: 'CommonJS' }
    }))
  }

  const plugin = esbuildPluginTsc({
    tsconfigPath: fs.existsSync(tmpConfig) ? tmpConfig : undefined
  })

  return {
    name: 'tsc-cjs',
    setup(build) {
      plugin.setup(build)

      // Clean up temp file after build
      build.onEnd(() => {
        try { fs.unlinkSync(tmpConfig) } catch (e) { /* ignore */ }
      })
    }
  }
}

const defaultPlugins = [recapDevAutoWrapper, esbuildPluginTscCjs()]
module.exports = { defaultPlugins, recapDevHandlerWrapper }
