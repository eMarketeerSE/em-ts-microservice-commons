import { resolveHandlerPath } from '../utils/handler-path'

describe('resolveHandlerPath', () => {
  describe('with handlerPath', () => {
    it('derives entryFile as src/handlers/<relative>.ts', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url'
      })
      expect(result.entryFile).toBe(
        'src/handlers/capture-screenshot/capture-screenshot-from-url.ts'
      )
    })

    it('does not set codePath when only handlerPath is provided', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url'
      })
      expect(result.codePath).toBeUndefined()
    })

    it('derives functionName from the last path segment', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url'
      })
      expect(result.functionName).toBe('capture-screenshot-from-url')
    })

    it('sets handler to index.handler', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/get-data'
      })
      expect(result.handler).toBe('index.handler')
    })

    it('strips .ts extension before deriving paths', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/get-data.ts'
      })
      expect(result.entryFile).toBe('src/handlers/get-data.ts')
      expect(result.functionName).toBe('get-data')
    })

    it('works without the src/handlers/ prefix', () => {
      const result = resolveHandlerPath({ handlerPath: 'get-data' })
      expect(result.entryFile).toBe('src/handlers/get-data.ts')
      expect(result.functionName).toBe('get-data')
    })

    it('respects explicit functionName override', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/capture-screenshot/capture-screenshot-from-url',
        functionName: 'custom-name'
      })
      expect(result.functionName).toBe('custom-name')
      expect(result.entryFile).toBe(
        'src/handlers/capture-screenshot/capture-screenshot-from-url.ts'
      )
    })

    it('respects explicit handler override', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/get-data',
        handler: 'main.handle'
      })
      expect(result.handler).toBe('main.handle')
    })

    it('passes codePath through and skips entryFile derivation when codePath is provided', () => {
      const result = resolveHandlerPath({
        handlerPath: 'src/handlers/get-data',
        codePath: './custom/path'
      })
      expect(result.codePath).toBe('./custom/path')
      expect(result.entryFile).toBeUndefined()
    })

    it('throws when handlerPath has directory components but does not start with src/handlers/', () => {
      expect(() =>
        resolveHandlerPath({ handlerPath: 'src/lambdas/foo' })
      ).toThrow(/must either be a bare basename or start with "src\/handlers\/"/)
    })

    it('throws when handlerPath is absolute', () => {
      expect(() =>
        resolveHandlerPath({ handlerPath: '/abs/path/foo' })
      ).toThrow(/must either be a bare basename or start with "src\/handlers\/"/)
    })
  })

  describe('without handlerPath', () => {
    it('returns functionName, handler, and codePath as provided', () => {
      const result = resolveHandlerPath({
        functionName: 'my-fn',
        handler: 'index.handler',
        codePath: './dist/handlers/my-fn'
      })
      expect(result.functionName).toBe('my-fn')
      expect(result.handler).toBe('index.handler')
      expect(result.codePath).toBe('./dist/handlers/my-fn')
      expect(result.entryFile).toBeUndefined()
    })

    it('throws when neither handlerPath nor functionName are provided', () => {
      expect(() => resolveHandlerPath({})).toThrow(
        'Either `handlerPath` or `functionName` must be provided.'
      )
    })
  })
})
