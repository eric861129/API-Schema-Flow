import { describe, expect, test } from 'vitest'
import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { loadWorkspaceSnapshot } from '../data/load-workspace'
import {
  createMappingCatalog,
  initialFieldSelection,
  validateMappingEdit,
} from './mapping-editor-model'
import { materializeReviewSession } from './review-engine'
import { createInitialReviewSession, reviewSessionReducer } from './review-session'
import { deriveBaselineRevisions } from './decision-factory'
import { projectReviewWorkspace } from './review-workspace-adapter'
import type { NormalizedSchema } from '@api-schema-flow/domain'

async function setup() {
  const snapshot = await loadWorkspaceSnapshot(
    '/fixture',
    async () => new Response(JSON.stringify(rawSnapshot)),
  )
  const candidate = snapshot.inferenceCandidates.find(
    (item) => item.sourceOperationKey === 'operation:get:/spaces/available',
  )!
  const catalog = createMappingCatalog(snapshot, candidate)
  const source = catalog.sources.find((item) => item.label === 'Response #/*/id')!
  const target = catalog.targets.find((item) => item.label === 'Body #/spaceId')!
  const input = {
    sourceId: source?.id ?? '',
    targetId: target?.id ?? '',
    sourceIndices: ['0'],
    targetIndices: [],
    template: '',
  }
  return { snapshot, candidate, catalog, source, target, input }
}

describe('mapping editor validation and decisions', () => {
  test('resolves parameter references and rejects referenced unions', async () => {
    const { snapshot, candidate, source, input } = await setup()
    const scalar = { ...source.schema, source: { uri: 'fixture://schema', pointer: '#/Scalar' } }
    const referenced: NormalizedSchema = {
      ...scalar,
      source: { uri: 'fixture://schema', pointer: '#/Reference' },
      types: [],
      resolvedRef: scalar.source,
    }
    const withParameter = (schema: NormalizedSchema, component = scalar) => ({
      ...snapshot,
      apiDocument: {
        ...snapshot.apiDocument,
        componentSchemas: [
          ...snapshot.apiDocument.componentSchemas,
          { name: 'Scalar', source: component.source, schema: component },
        ],
        operations: snapshot.apiDocument.operations.map((operation) =>
          operation.id === candidate.targetOperationKey
            ? {
                ...operation,
                parameters: [
                  {
                    name: 'space',
                    location: 'query' as const,
                    required: true,
                    deprecated: false,
                    source: schema.source,
                    schema,
                  },
                ],
              }
            : operation,
        ),
      },
    })
    const resolved = createMappingCatalog(withParameter(referenced), candidate)
    const parameter = resolved.targets.find((field) => field.label === 'query.space')!
    expect(
      validateMappingEdit(resolved, { ...input, targetId: parameter.id }).mapping?.target,
    ).toEqual({ kind: 'query-parameter', name: 'space' })
    const alternative = { ...scalar, source: { ...scalar.source, pointer: '#/Scalar/oneOf/0' } }
    for (const union of [
      { ...scalar, oneOf: [alternative] },
      { ...scalar, anyOf: [alternative] },
    ]) {
      for (const schema of [union, referenced]) {
        const catalog = createMappingCatalog(withParameter(schema, union), candidate)
        const field = catalog.targets.find((item) => item.label === 'query.space')!
        expect(field.unavailable).toContain('Ambiguous')
        expect(
          validateMappingEdit(catalog, { ...input, targetId: field.id }).mapping,
        ).toBeUndefined()
      }
    }
  })

  test('blocks union descendants and propagates parent access and null restrictions', async () => {
    const { snapshot, candidate, source } = await setup()
    const object: NormalizedSchema = {
      ...source.schema,
      types: ['object'],
      properties: { id: source.schema },
      required: ['id'],
    }
    const withSchemas = (response: NormalizedSchema, body: NormalizedSchema) => ({
      ...snapshot,
      apiDocument: {
        ...snapshot.apiDocument,
        operations: snapshot.apiDocument.operations.map((operation) => {
          if (operation.id === candidate.sourceOperationKey)
            return {
              ...operation,
              responses: [
                {
                  statusCode: '200',
                  description: '',
                  source: response.source,
                  links: [],
                  content: [
                    { mediaType: 'application/json', source: response.source, schema: response },
                  ],
                },
              ],
            }
          if (operation.id === candidate.targetOperationKey)
            return {
              ...operation,
              requestBody: {
                required: true,
                source: body.source,
                content: [{ mediaType: 'application/json', source: body.source, schema: body }],
              },
            }
          return operation
        }),
      },
    })
    const readonly = createMappingCatalog(
      withSchemas(object, { ...object, readOnly: true }),
      candidate,
    )
    expect(readonly.targets.find((item) => item.label === 'Body #/id')?.unavailable).toContain(
      'Read-only',
    )
    const writeonly = createMappingCatalog(
      withSchemas({ ...object, writeOnly: true }, object),
      candidate,
    )
    expect(writeonly.sources.find((item) => item.label === 'Response #/id')?.unavailable).toContain(
      'Write-only',
    )
    const nullable = createMappingCatalog(
      withSchemas({ ...object, nullable: true }, object),
      candidate,
    )
    expect(
      validateMappingEdit(nullable, {
        sourceId: nullable.sources[0]!.id,
        targetId: nullable.targets[0]!.id,
        sourceIndices: [],
        targetIndices: [],
        template: '',
      }).mapping,
    ).toBeUndefined()
    const union = {
      ...object,
      source: { uri: 'fixture://union', pointer: '#/Union' },
      oneOf: [object],
    }
    const reference = { ...object, properties: {}, types: [], resolvedRef: union.source }
    const input = withSchemas(reference, object)
    const catalog = createMappingCatalog(
      {
        ...input,
        apiDocument: {
          ...input.apiDocument,
          componentSchemas: [
            ...input.apiDocument.componentSchemas,
            { name: 'Union', source: union.source, schema: union },
          ],
        },
      },
      candidate,
    )
    expect(catalog.sources.every((item) => Boolean(item.unavailable))).toBe(true)
    expect(catalog.sources.some((item) => item.label === 'Response #/id')).toBe(false)
  })
  test('requires an explicit array index and preserves escaped property tokens', async () => {
    const { catalog, input } = await setup()
    expect(validateMappingEdit(catalog, { ...input, sourceIndices: [] }).errors).toContain(
      'Enter an explicit non-negative integer for every array index.',
    )
    for (const value of ['-1', '1.5', '01', '1e2', '9007199254740992'])
      expect(
        validateMappingEdit(catalog, { ...input, sourceIndices: [value] }).mapping,
      ).toBeUndefined()
    expect(validateMappingEdit(catalog, input).mapping?.source).toEqual({
      kind: 'response-body',
      pointer: '#/0/id',
    })
  })

  test('rejects unknown fields, incompatible types, and script-like templates', async () => {
    const { catalog, input, source, target } = await setup()
    expect(validateMappingEdit(catalog, { ...input, sourceId: 'forged' }).mapping).toBeUndefined()
    const incompatible = {
      ...catalog,
      targets: [{ ...target, schema: { ...target.schema, types: ['boolean'] } }],
    }
    expect(validateMappingEdit(incompatible, input).mapping).toBeUndefined()
    for (const template of ['hello', '{$value}{$value}', '{$value}${eval()}'])
      expect(validateMappingEdit(catalog, { ...input, template }).mapping).toBeUndefined()
    expect(
      validateMappingEdit(catalog, { ...input, template: 'ID-{$value}' }).mapping,
    ).toBeUndefined()
    const plainTarget = { ...target.schema, format: '' }
    expect(
      validateMappingEdit(
        { ...catalog, targets: [{ ...target, schema: plainTarget }] },
        { ...input, template: 'ID-{$value}' },
      ).mapping?.transform?.raw,
    ).toBe('ID-{$steps.source.outputs.value}')
    const nullable = {
      ...catalog,
      sources: [{ ...source, schema: { ...source.schema, nullable: true } }],
    }
    expect(validateMappingEdit(nullable, input).mapping).toBeUndefined()
  })

  test('creates manual accepted topology, displays the edit, supersedes revisions and undoes without mutating baseline', async () => {
    const { snapshot, candidate, catalog, input } = await setup()
    const before = JSON.stringify(snapshot)
    const initial = createInitialReviewSession({
      ...snapshot.reviewContext,
      baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
    })
    const mapping = validateMappingEdit(catalog, input).mapping!
    expect(mapping).toBeDefined()
    const edited = reviewSessionReducer(initial, {
      type: 'edit-candidate',
      candidateId: candidate.id,
      mapping,
    })
    const result = materializeReviewSession(snapshot, edited)
    const edge = result.result.graph.edges.find(
      (item) => item.review?.candidateId === candidate.id,
    )!
    expect(edge.provenance).toBe('manual')
    expect(edge.review?.derivedFromCandidateId).toBe(candidate.id)
    expect(edge.mappings[0]?.source).toEqual(mapping.source)
    const detail = projectReviewWorkspace(snapshot, result).details.get(candidate.id)!
    expect(detail.state).toBe('edited')
    expect(detail.sourceSelector).toBe('$response.body#/0/id')
    const rejected = reviewSessionReducer(edited, {
      type: 'reject-candidate',
      candidateId: candidate.id,
      reason: 'wrong-field',
    })
    expect(
      materializeReviewSession(snapshot, rejected).result.graph.edges.find(
        (item) => item.review?.candidateId === candidate.id,
      ),
    ).toBeUndefined()
    expect(
      materializeReviewSession(
        snapshot,
        reviewSessionReducer(rejected, { type: 'undo-last-draft' }),
      ).result.graph,
    ).toEqual(result.result.graph)
    expect(
      materializeReviewSession(snapshot, reviewSessionReducer(edited, { type: 'undo-last-draft' }))
        .result.graph,
    ).toEqual(snapshot.acceptedGraph)
    expect(initialFieldSelection(catalog.sources, mapping.source)).toEqual({
      id: input.sourceId,
      indices: ['0'],
    })
    expect(JSON.stringify(snapshot)).toBe(before)
  })
})
