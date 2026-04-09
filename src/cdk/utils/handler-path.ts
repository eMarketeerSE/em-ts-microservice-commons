import * as path from 'path'

const DEFAULT_HANDLERS_DIR = 'src/handlers'
const DEFAULT_OUT_DIR = 'dist/handlers'

export interface HandlerPathConfig {
  readonly handlerPath?: string
  readonly functionName?: string
  readonly handler?: string
  readonly codePath?: string
}

export interface ResolvedHandlerPath {
  readonly functionName: string
  readonly handler?: string
  readonly codePath?: string
}

/**
 * Resolve `handlerPath` into `codePath`, `handler`, and optionally `functionName`.
 *
 * Given `handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url'`:
 * - `codePath` → `'dist/handlers/capture-screenshot/capture-screenshot-from-url'`
 * - `handler` → `'index.handler'`
 * - `functionName` → `'capture-screenshot-from-url'` (only when not explicitly provided)
 *
 * When `handlerPath` is not provided, `functionName` is required.
 * `handler` and `codePath` may remain undefined if the caller has its own defaults.
 */
export function resolveHandlerPath(config: HandlerPathConfig): ResolvedHandlerPath {
  const { handlerPath } = config

  if (handlerPath) {
    const normalised = handlerPath.replace(/\.ts$/, '')
    const relative = normalised.startsWith(DEFAULT_HANDLERS_DIR + '/')
      ? normalised.slice(DEFAULT_HANDLERS_DIR.length + 1)
      : normalised

    return {
      functionName: config.functionName ?? path.basename(relative),
      handler: config.handler ?? 'index.handler',
      codePath: config.codePath ?? path.join(DEFAULT_OUT_DIR, relative)
    }
  }

  if (!config.functionName) {
    throw new Error('Either `handlerPath` or `functionName` must be provided.')
  }

  return {
    functionName: config.functionName,
    handler: config.handler,
    codePath: config.codePath
  }
}
