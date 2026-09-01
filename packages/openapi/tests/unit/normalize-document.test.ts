import { describe, expect, test } from 'vitest'

import { normalizeOpenApiDocument } from '../../src/index.js'

const source = {
  uri: 'memory://reservation.json',
  contents: '{}',
  byteLength: 2,
} as const

const document = {
  openapi: '3.1.0',
  info: { title: 'Reservation API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:4010' }],
  security: [{ bearerAuth: [] }],
  tags: [{ name: 'Reservations' }, { name: 'Spaces' }],
  paths: {
    '/reservations/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      get: {
        operationId: 'getReservation',
        tags: ['Reservations'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Operation-level value wins.',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reservation' } },
            },
          },
        },
      },
    },
    '/reservations': {
      post: {
        operationId: 'createReservation',
        tags: ['Reservations'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReservationRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reservation' } },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      ReservationRequest: {
        type: 'object',
        required: ['spaceId'],
        properties: { spaceId: { type: 'string', format: 'uuid' } },
      },
      Reservation: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  },
}

describe('OpenAPI normalization', () => {
  test('normalizes operations deterministically and merges parameters', () => {
    const first = normalizeOpenApiDocument(document, source)
    const second = normalizeOpenApiDocument(document, source)

    expect(first).toEqual(second)
    expect(first.diagnostics).toEqual([])
    expect(first.document?.operations.map(({ id }) => id)).toEqual([
      'operation:post:/reservations',
      'operation:get:/reservations/{id}',
    ])
    expect(first.document?.operations[1]?.parameters).toHaveLength(1)
    expect(first.document?.operations[1]?.parameters[0]).toMatchObject({
      name: 'id',
      location: 'path',
      description: 'Operation-level value wins.',
    })
    expect(first.document?.componentSchemas.map(({ name }) => name)).toEqual([
      'Reservation',
      'ReservationRequest',
    ])
  })

  test('emits a compatibility warning for OpenAPI 3.2', () => {
    const result = normalizeOpenApiDocument({ ...document, openapi: '3.2.0' }, source)
    expect(result.document?.compatibilityMode).toBe(true)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-2001', severity: 'warning' }),
    ])
  })

  test('rejects unsupported versions before walking paths', () => {
    const result = normalizeOpenApiDocument({ ...document, openapi: '4.0.0' }, source)
    expect(result.document).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-1002', severity: 'error' }),
    ])
  })
})
