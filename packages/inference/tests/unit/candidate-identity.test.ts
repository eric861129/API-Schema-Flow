import type { FlowValueSelector, FlowValueTarget } from '@api-schema-flow/domain'
import { describe, expect, test } from 'vitest'

import {
  createInferenceFingerprint,
  type InferenceSourceField,
  type InferenceTargetField,
} from '../../src/index.js'

const selector: FlowValueSelector = { kind: 'response-body', pointer: '#/id' }
const target: FlowValueTarget = { kind: 'path-parameter', name: 'id' }

function sourceField(
  uri: string,
  schemaPointer = '#/paths/~1reservations/post/responses/201/content/application~1json/schema/properties/id',
): InferenceSourceField {
  return {
    sourceId: 'api',
    operationNodeId: 'endpoint:api:operation:post:/reservations',
    operationKey: 'operation:post:/reservations',
    operationId: 'createReservation',
    method: 'post',
    path: '/reservations',
    tags: ['Reservations'],
    name: 'id',
    normalizedName: {
      original: 'id',
      tokens: ['id'],
      signature: 'id',
      genericId: true,
      secretLike: false,
    },
    schemaTypes: ['string'],
    format: 'uuid',
    sourcePointer: {
      uri,
      pointer: schemaPointer,
    },
    resourceKey: 'reservations',
    readOnly: false,
    writeOnly: false,
    required: true,
    arrayDepth: 0,
    variant: false,
    selector,
    statusCode: '201',
  }
}

function targetField(
  uri: string,
  schemaPointer = '#/paths/~1reservations~1{id}/get/parameters/0/schema',
): InferenceTargetField {
  return {
    sourceId: 'api',
    operationNodeId: 'endpoint:api:operation:get:/reservations/{id}',
    operationKey: 'operation:get:/reservations/{id}',
    operationId: 'getReservation',
    method: 'get',
    path: '/reservations/{id}',
    tags: ['Reservations'],
    name: 'id',
    normalizedName: {
      original: 'id',
      tokens: ['id'],
      signature: 'id',
      genericId: true,
      secretLike: false,
    },
    schemaTypes: ['string'],
    format: 'uuid',
    sourcePointer: {
      uri,
      pointer: schemaPointer,
    },
    resourceKey: 'reservations',
    readOnly: false,
    writeOnly: false,
    required: true,
    arrayDepth: 0,
    variant: false,
    target,
    securityTarget: false,
    bearerTarget: false,
  }
}

describe('inference candidate identity', () => {
  test('is stable across source URI and schema-definition location changes', () => {
    const memoryFingerprint = createInferenceFingerprint(
      sourceField('memory://fixtures/reservation.yaml'),
      targetField('memory://fixtures/reservation.yaml'),
      selector,
      target,
    )
    const fileFingerprint = createInferenceFingerprint(
      sourceField(
        'file:///tmp/checkouts/reservation.yaml',
        '#/components/schemas/Reservation/properties/id',
      ),
      targetField(
        'file:///tmp/checkouts/reservation.yaml',
        '#/components/parameters/ReservationId/schema',
      ),
      selector,
      target,
    )

    expect(fileFingerprint).toBe(memoryFingerprint)
  })
})
