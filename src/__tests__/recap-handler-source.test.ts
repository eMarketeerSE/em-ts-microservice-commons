import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as esbuild from 'esbuild'
import { recapHandlerSource } from '../recap-handler-source'

describe('recapHandlerSource', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recap-handler-'))

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true })
  })

  it('should send the event to recap.dev without the api key and give the handler the full event', async () => {
    fs.writeFileSync(path.join(workDir, 'handler.ts'), [
      'import { tracer } from \'@recap.dev/client\'',
      'export const handler = async (event: any) => ({',
      '  handlerHeader: event.headers[\'X-API-Key\'],',
      '  traceRequest: tracer.getCurrentTrace().request,',
      '})',
    ].join('\n'))
    await esbuild.build({
      stdin: { contents: recapHandlerSource('./handler'), resolveDir: workDir, loader: 'ts' },
      outfile: path.join(workDir, 'index.js'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      nodePaths: [path.resolve('node_modules')],
    })
    const { handler } = require(path.join(workDir, 'index.js'))
    const event = {
      headers: { 'X-API-Key': 'secret-1', Host: 'api.example.com' },
      multiValueHeaders: { 'x-api-key': ['secret-1'] },
      requestContext: { identity: { apiKey: 'secret-1', apiKeyId: 'key-id-1' } },
    }

    const result = await handler(event, { functionName: 'test', awsRequestId: 'request-1' })

    expect(result).toEqual({
      handlerHeader: 'secret-1',
      traceRequest: {
        headers: { 'X-API-Key': '[removed]', Host: 'api.example.com' },
        multiValueHeaders: { 'x-api-key': '[removed]' },
        requestContext: { identity: { apiKey: '[removed]', apiKeyId: 'key-id-1' } },
      },
    })
  })
})
