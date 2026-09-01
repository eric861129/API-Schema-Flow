import { normalizeArazzoDocument, type NormalizedArazzoDocument } from '../../src/index.js'

export const arazzoSource = {
  uri: 'file:///workspace/workflow.arazzo.yaml',
  contents: 'arazzo: 1.1.0\n',
  byteLength: 14,
} as const

export function normalizedDocument(
  workflows: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): NormalizedArazzoDocument {
  const result = normalizeArazzoDocument(
    {
      arazzo: '1.1.0',
      info: { title: 'Test workflows', version: '1.0.0' },
      sourceDescriptions: [{ name: 'api', url: './openapi.yaml', type: 'openapi' }],
      workflows,
      ...overrides,
    },
    arazzoSource,
  )
  if (!result.document) throw new Error('Expected normalized Arazzo document')
  return result.document
}

export function operationStep(
  stepId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    stepId,
    operationId: stepId,
    successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }],
    ...overrides,
  }
}
