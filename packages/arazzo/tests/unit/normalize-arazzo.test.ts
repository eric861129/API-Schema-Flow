import { describe, expect, test } from 'vitest'

import { normalizeArazzoDocument } from '../../src/index.js'

const source = {
  uri: 'file:///workspace/workflows/reservation.arazzo.yaml',
  contents: 'arazzo: 1.1.0\n',
  byteLength: 14,
} as const

function canonicalDocument() {
  return {
    arazzo: '1.1.0',
    $self: './reservation.arazzo.yaml',
    info: {
      title: 'Reservation workflows',
      version: '0.1.0',
      summary: 'Canonical workflow set',
      'x-info-owner': 'platform',
      audience: 'frontend',
    },
    sourceDescriptions: [
      {
        name: 'reservationApi',
        url: '../openapi.yaml',
        type: 'openapi',
        'x-source-color': 'blue',
        cache: 'disabled',
      },
    ],
    workflows: [
      {
        workflowId: 'createReservation',
        summary: 'Create and retrieve a reservation',
        inputs: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
        parameters: [
          {
            name: 'Authorization',
            in: 'header',
            value: 'Bearer {$steps.login.outputs.token}',
            'x-sensitive': true,
          },
        ],
        steps: [
          {
            stepId: 'login',
            operationId: 'login',
            requestBody: {
              contentType: 'application/json',
              payload: {
                username: '$inputs.username',
                password: '$inputs.password',
              },
            },
            successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }],
            outputs: { token: '$response.body#/token' },
            'x-step-note': 'authentication',
          },
          {
            stepId: 'reserve',
            operationPath: '{$sourceDescriptions.reservationApi.url}#/paths/~1reservations/post',
            dependsOn: ['login'],
            parameters: [
              {
                name: 'Authorization',
                in: 'header',
                value: 'Bearer {$steps.login.outputs.token}',
              },
            ],
            requestBody: {
              contentType: 'application/json',
              payload: { spaceId: '$inputs.spaceId' },
            },
            outputs: { id: '$response.body#/id' },
            timeout: 3000,
          },
        ],
        outputs: { reservationId: '$steps.reserve.outputs.id' },
        'x-workflow-owner': 'frontend',
        futureWorkflowField: { mode: 'preserve' },
      },
    ],
    components: {
      parameters: {
        authorization: {
          name: 'Authorization',
          in: 'header',
          value: 'Bearer {$steps.login.outputs.token}',
        },
      },
    },
    'x-schema-flow': { layout: 'layered' },
    futureRootField: { mode: 'preserve' },
  }
}

describe('Arazzo normalization', () => {
  test('normalizes the canonical workflow with typed values and stable source pointers', () => {
    const result = normalizeArazzoDocument(canonicalDocument(), source)

    expect(result.diagnostics).toEqual([])
    expect(result.document).toMatchObject({
      schemaVersion: '1.0',
      sourceUri: source.uri,
      arazzoVersion: '1.1.0',
      self: './reservation.arazzo.yaml',
      source: { uri: source.uri, pointer: '#' },
      info: {
        title: 'Reservation workflows',
        version: '0.1.0',
        extensions: { 'x-info-owner': 'platform' },
        preservedFields: { audience: 'frontend' },
      },
      extensions: { 'x-schema-flow': { layout: 'layered' } },
      preservedFields: { futureRootField: { mode: 'preserve' } },
    })

    expect(result.document?.sourceDescriptions[0]).toMatchObject({
      name: 'reservationApi',
      url: '../openapi.yaml',
      type: 'openapi',
      source: { uri: source.uri, pointer: '#/sourceDescriptions/0' },
      extensions: { 'x-source-color': 'blue' },
      preservedFields: { cache: 'disabled' },
    })

    const workflow = result.document?.workflows[0]
    expect(workflow?.steps.map(({ stepId }) => stepId)).toEqual(['login', 'reserve'])
    expect(workflow?.steps[0]?.targets).toEqual([{ type: 'operationId', operationId: 'login' }])
    expect(workflow?.steps[1]?.targets).toEqual([
      {
        type: 'operationPath',
        operationPath: '{$sourceDescriptions.reservationApi.url}#/paths/~1reservations/post',
      },
    ])
    expect(workflow?.parameters[0]?.value).toMatchObject({ kind: 'template' })
    expect(workflow?.steps[0]?.requestBody?.payload).toMatchObject({ kind: 'object' })
    expect(workflow?.steps[0]?.outputs.token).toMatchObject({
      kind: 'expression',
      expression: { kind: 'http', message: 'response', location: 'body' },
    })
    expect(workflow?.outputs.reservationId).toMatchObject({
      kind: 'expression',
      expression: { kind: 'step-output', stepId: 'reserve', outputName: 'id' },
    })
    expect(workflow?.extensions).toEqual({ 'x-workflow-owner': 'frontend' })
    expect(workflow?.preservedFields).toEqual({
      futureWorkflowField: { mode: 'preserve' },
    })
  })

  test('produces deterministic output without mutating or retaining input references', () => {
    const input = canonicalDocument()
    const first = normalizeArazzoDocument(input, source)
    const second = normalizeArazzoDocument(input, source)

    expect(first).toEqual(second)
    input.info.title = 'Mutated after normalization'
    input.workflows[0]!.steps[0]!.outputs.token = 'changed'
    input.futureRootField.mode = 'changed'

    expect(first.document?.info.title).toBe('Reservation workflows')
    expect(first.document?.workflows[0]?.steps[0]?.outputs.token).toMatchObject({
      kind: 'expression',
      expression: { raw: '$response.body#/token' },
    })
    expect(first.document?.preservedFields).toEqual({
      futureRootField: { mode: 'preserve' },
    })
  })

  test('keeps condition expressions as literals while diagnosing malformed runtime values', () => {
    const input = canonicalDocument()
    input.workflows[0]!.steps[0]!.parameters = [
      { name: 'broken', in: 'header', value: '$steps.login.token' },
    ]

    const result = normalizeArazzoDocument(input, source)

    expect(result.document?.workflows[0]?.steps[0]?.successCriteria[0]?.condition).toMatchObject({
      kind: 'literal',
      value: '$statusCode == 200',
    })
    expect(result.document?.workflows[0]?.steps[0]?.parameters[0]?.value).toMatchObject({
      kind: 'literal',
      value: '$steps.login.token',
    })
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1010', severity: 'error' }),
    ])
  })
})
