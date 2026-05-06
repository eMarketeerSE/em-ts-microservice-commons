import * as path from 'path'

const DEFAULT_HANDLERS_DIR = 'src/handlers'

/**
 * Public type for constructing handler path config. Enforces at compile time
 * that either `handlerPath` or `functionName` is provided — the runtime throw
 * in `resolveHandlerPath` is a safety net for internal callers that widen the type.
 */
export type HandlerPathConfig =
  | {
      readonly handlerPath: string
      readonly functionName?: string
      readonly handler?: string
      readonly codePath?: string
    }
  | {
      readonly handlerPath?: undefined
      readonly functionName: string
      readonly handler?: string
      readonly codePath?: string
    }

export interface ResolvedHandlerPath {
  readonly functionName: string
  readonly handler?: string
  /**
   * Absolute or project-relative path to the source TS handler file derived
   * from `handlerPath`. Unset when the caller provided an explicit `codePath`
   * (escape hatch — code is packaged as-is, no bundling).
   */
  readonly entryFile?: string
  /** Pass-through of an explicit `codePath` from the input config. */
  readonly codePath?: string
}

/**
 * Internal flat type accepted by `resolveHandlerPath`. Wider than `HandlerPathConfig`
 * so that internal call sites passing objects with both fields optional still compile.
 * The invariant is enforced at public API boundaries via `HandlerPathConfig`.
 */
interface HandlerPathInput {
  readonly handlerPath?: string
  readonly functionName?: string
  readonly handler?: string
  readonly codePath?: string
}

/**
 * Resolve `handlerPath` into `entryFile`, `handler`, and optionally `functionName`.
 *
 * Given `handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url'`:
 * - `entryFile` → `'src/handlers/capture-screenshot/capture-screenshot-from-url.ts'`
 * - `handler` → `'index.handler'`
 * - `functionName` → `'capture-screenshot-from-url'` (only when not explicitly provided)
 *
 * When `codePath` is provided, `entryFile` is left unset — the construct will
 * package `codePath` directly (no bundling).
 *
 * When `handlerPath` is not provided, `functionName` is required.
 */
export function resolveHandlerPath(config: HandlerPathInput): ResolvedHandlerPath {
  const { handlerPath } = config

  if (handlerPath) {
    const normalised = handlerPath.replace(/\.ts$/, '')
    const startsWithHandlersDir = normalised.startsWith(`${DEFAULT_HANDLERS_DIR}/`)
    const containsSeparator = normalised.includes('/') || normalised.includes(path.sep)

    if (!startsWithHandlersDir && (path.isAbsolute(normalised) || containsSeparator)) {
      // A bare basename like 'get-data' is fine (treated as relative to
      // src/handlers). Anything with directory components must be rooted at
      // DEFAULT_HANDLERS_DIR — otherwise we'd silently produce e.g.
      // 'src/lambdas/foo.ts' and fail at synth with an opaque
      // Code.fromAsset error far from the call site.
      throw new Error(
        `resolveHandlerPath: handlerPath "${handlerPath}" must either be a bare basename or start with "${DEFAULT_HANDLERS_DIR}/".`
      )
    }

    const relative = startsWithHandlersDir
      ? normalised.slice(DEFAULT_HANDLERS_DIR.length + 1)
      : normalised

    return {
      functionName: config.functionName ?? path.basename(relative),
      handler: config.handler ?? 'index.handler',
      entryFile: config.codePath ? undefined : path.join(DEFAULT_HANDLERS_DIR, `${relative}.ts`),
      codePath: config.codePath
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
