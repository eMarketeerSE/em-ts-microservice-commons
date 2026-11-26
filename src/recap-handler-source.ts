export const recapHandlerSource = (originalFile: string): string => [
  'import { tracer, wrapLambdaHandler } from \'@recap.dev/client\'',
  `import * as unwrappedHandler from '${originalFile}'`,
  'const API_KEY_FIELDS = [\'x-api-key\', \'apikey\']',
  'export const handler = wrapLambdaHandler((event: any, context: any) => {',
  '  const trace = tracer.getCurrentTrace()',
  '  if (trace) {',
  '    trace.request = JSON.parse(JSON.stringify(event ?? null, (key, value) => (',
  '      API_KEY_FIELDS.includes(key.toLowerCase()) ? \'[removed]\' : value)))',
  '  }',
  '  return unwrappedHandler.handler(event, context)',
  '})',
].join('\n')
