import { describe, expect, it } from 'vitest'
import type { NormalizedOperation } from '@api-schema-flow/domain'

import fixture from '../../../../apps/web/public/fixtures/reservation-workspace.json'
import { InMemoryMockSession, assessMockPair } from '../../src/index.js'

const operations = fixture.apiDocument.operations as unknown as NormalizedOperation[]
const create = operations.find((operation) => operation.operationId === 'createReservation')!
const read = operations.find((operation) => operation.operationId === 'getReservation')!
const body = {
  spaceId: '11111111-1111-4111-8111-111111111111',
  startTime: '2026-09-18T09:00:00Z',
  endTime: '2026-09-18T10:00:00Z',
}

describe('local in-memory mock session', () => {
  it('creates and reads the same schema-shaped entity with deterministic IDs', () => {
    expect(assessMockPair(create, read)).toBeNull()
    const session = new InMemoryMockSession()
    const first = session.create(create, body)
    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({ ...body, status: 'pending' })
    expect(first.body.id).toBe('00000000-0000-4000-8000-000000000001')
    expect(session.read(read, first.body.id as string).body).toBe(first.body)
    expect(session.summary.entityCount).toBe(1)
    expect(new InMemoryMockSession().summary.entityCount).toBe(0)
    session.reset()
    expect(session.summary.entityCount).toBe(0)
    expect(session.read(read, first.body.id as string).status).toBe(404)
    expect(session.create(create, body).body.id).toBe(first.body.id)
  })

  it('rejects invalid request fields before changing state', () => {
    const session = new InMemoryMockSession()
    expect(() => session.create(create, { ...body, attendees: 'ten' })).toThrow('attendees')
    expect(() => session.create(create, { spaceId: body.spaceId })).toThrow('endTime')
    expect(session.summary).toEqual({ entityCount: 0, revision: 0 })
  })
})
