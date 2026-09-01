import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createSourceRetrievalPolicy } from '@api-schema-flow/source-loader'
import { createNodeSourceAcquirer } from '@api-schema-flow/source-loader/node'
import { describe, expect, test } from 'vitest'

import * as openApi from '../../src/index.js'

const processOpenApiLocation = Reflect.get(openApi, 'processOpenApiLocation') as
  | ((
      location: unknown,
      options: unknown,
    ) => Promise<{
      document?: {
        fingerprint?: string
        sourceCount?: number
        referenceCount?: number
        componentSchemas: readonly {
          name: string
          schema: { resolvedRef?: { uri: string; pointer: string } }
        }[]
      }
      diagnostics: readonly { severity: string }[]
    }>)
  | undefined

describe('multi-file OpenAPI ingestion', () => {
  test('resolves a relative component reference with a deterministic fingerprint', async () => {
    expect(processOpenApiLocation).toEqual(expect.any(Function))
    if (typeof processOpenApiLocation !== 'function') return

    const entryPath = fileURLToPath(
      new URL('../../../../fixtures/openapi/refs/multi-file/openapi.yaml', import.meta.url),
    )
    const componentsPath = fileURLToPath(
      new URL('../../../../fixtures/openapi/refs/multi-file/components.yaml', import.meta.url),
    )
    const policy = createSourceRetrievalPolicy({ allowedFileRoots: [dirname(entryPath)] })
    const options = { acquirer: createNodeSourceAcquirer(), policy }

    const first = await processOpenApiLocation({ kind: 'file', path: entryPath }, options)
    const second = await processOpenApiLocation({ kind: 'file', path: entryPath }, options)

    expect(first.diagnostics.filter(({ severity }) => severity === 'error')).toEqual([])
    expect(first.document).toMatchObject({
      sourceCount: 2,
      referenceCount: 1,
    })
    expect(first.document?.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(second.document?.fingerprint).toBe(first.document?.fingerprint)
    expect(
      first.document?.componentSchemas.find(({ name }) => name === 'Reservation')?.schema
        .resolvedRef,
    ).toEqual({
      uri: pathToFileURL(componentsPath).href,
      pointer: '#/components/schemas/Reservation',
    })
  })
})
