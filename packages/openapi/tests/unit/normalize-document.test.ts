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

  test('preserves the source pointer of inherited root servers', () => {
    const result = normalizeOpenApiDocument(document, source)
    expect(result.document?.operations[0]?.servers[0]?.source).toEqual({
      uri: source.uri,
      pointer: '#/servers/0',
    })
  })

  test('preserves OpenAPI security alternative groups', () => {
    const result = normalizeOpenApiDocument(
      {
        ...document,
        security: [{ oauth: ['read'], apiKey: [] }, { bearerAuth: [] }],
      },
      source,
    )

    expect(result.document?.operations[0]?.security).toEqual([
      { requirementIndex: 0, scheme: 'apiKey', scopes: [] },
      { requirementIndex: 0, scheme: 'oauth', scopes: ['read'] },
      { requirementIndex: 1, scheme: 'bearerAuth', scopes: [] },
    ])
  })

  test('redacts secret-shaped examples and defaults in normalized schemas', () => {
    const result = normalizeOpenApiDocument(
      {
        ...document,
        components: {
          ...document.components,
          schemas: {
            ...document.components.schemas,
            Credentials: {
              type: 'object',
              properties: {
                password: { type: 'string', example: 'password-secret' },
                accessToken: { type: 'string', default: 'token-secret' },
                email: { type: 'string', example: 'developer@example.test' },
              },
            },
          },
        },
      },
      source,
    )

    const schema = result.document?.componentSchemas.find(({ name }) => name === 'Credentials')
    expect(schema?.schema.properties.password?.example).toBe('[REDACTED]')
    expect(schema?.schema.properties.accessToken?.defaultValue).toBe('[REDACTED]')
    expect(schema?.schema.properties.email?.example).toBe('developer@example.test')
  })

  test('retains the OpenAPI 3.2 querystring parameter location in compatibility mode', () => {
    const result = normalizeOpenApiDocument(
      {
        ...document,
        openapi: '3.2.0',
        paths: {
          '/search': {
            get: {
              parameters: [
                {
                  name: 'filters',
                  in: 'querystring',
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      },
      source,
    )

    expect(result.document?.operations[0]?.parameters[0]?.location).toBe('querystring')
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
