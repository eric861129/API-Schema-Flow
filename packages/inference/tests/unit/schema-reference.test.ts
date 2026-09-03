import type { NormalizedSchema } from '@api-schema-flow/domain'
import { buildDeclaredFlowGraphs } from '@api-schema-flow/flow'
import { describe, expect, test } from 'vitest'

import { inferFlowCandidates } from '../../src/index.js'
import { createInferenceSource, pointer } from '../helpers/fixture.js'

function referenceSchema(target: string): NormalizedSchema {
  return {
    source: pointer('#/paths/~1reservations/post/responses/201/content/application~1json/schema'),
    ref: target,
    resolvedRef: pointer(target),
    types: [],
    required: [],
    properties: {},
    enumValues: [],
    allOf: [],
    anyOf: [],
    oneOf: [],
    nullable: false,
    readOnly: false,
    writeOnly: false,
    deprecated: false,
  }
}

describe('inference schema-reference resolution', () => {
  test('indexes fields reached through an internal component reference', () => {
    const inlineSource = createInferenceSource()
    const createReservation = inlineSource.document.operations.find(
      ({ operationId }) => operationId === 'createReservation',
    )!
    const reservationSchema = createReservation.responses[0]!.content[0]!.schema!
    const componentPointer = '#/components/schemas/Reservation'
    const referencedSource = {
      ...inlineSource,
      document: {
        ...inlineSource.document,
        componentSchemas: [
          {
            name: 'Reservation',
            schema: {
              ...reservationSchema,
              source: pointer(componentPointer),
              properties: Object.fromEntries(
                Object.entries(reservationSchema.properties).map(([name, schema]) => [
                  name,
                  { ...schema, source: pointer(`${componentPointer}/properties/${name}`) },
                ]),
              ),
            },
            source: pointer(componentPointer),
          },
        ],
        operations: inlineSource.document.operations.map((operation) =>
          operation.operationId === 'createReservation'
            ? {
                ...operation,
                responses: operation.responses.map((response) =>
                  response.statusCode === '201'
                    ? {
                        ...response,
                        content: response.content.map((media) => ({
                          ...media,
                          schema: referenceSchema(componentPointer),
                        })),
                      }
                    : response,
                ),
              }
            : operation,
        ),
      },
    }
    const graph = buildDeclaredFlowGraphs({ openApiSources: [referencedSource] }).operationGraph

    const report = inferFlowCandidates({
      openApiSources: [referencedSource],
      declaredOperationGraph: graph,
    })

    expect(report.metrics.sourceFieldCount).toBeGreaterThan(0)
    expect(
      report.candidates.some(
        ({ sourceOperationKey, targetOperationKey, mapping }) =>
          sourceOperationKey === 'operation:post:/reservations' &&
          targetOperationKey === 'operation:get:/reservations/{id}' &&
          mapping.source.kind === 'response-body' &&
          mapping.source.pointer === '#/id' &&
          mapping.target.kind === 'path-parameter' &&
          mapping.target.name === 'id',
      ),
    ).toBe(true)
  })
})
