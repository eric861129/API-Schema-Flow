import { describe, expect, test } from 'vitest'

type InferenceApi = {
  readonly INFERENCE_RULE_SET_VERSION?: string
  readonly DEFAULT_INFERENCE_CONFIG?: Readonly<Record<string, unknown>>
  readonly resolveInferenceConfig?: (value?: Readonly<Record<string, unknown>>) => {
    readonly config?: Readonly<Record<string, unknown>>
    readonly diagnostics: readonly unknown[]
  }
  readonly normalizeFieldName?: (value: string) => {
    readonly original: string
    readonly tokens: readonly string[]
    readonly signature: string
    readonly genericId: boolean
    readonly secretLike: boolean
  }
  readonly normalizeResourceSegment?: (value: string) => string
}

async function api(): Promise<InferenceApi> {
  return (await import('../../src/index.js')) as InferenceApi
}

describe('inference configuration and naming', () => {
  test('exposes the exact M2-C defaults', async () => {
    const module = await api()

    expect(module.INFERENCE_RULE_SET_VERSION).toBe('m2c-v1')
    expect(module.DEFAULT_INFERENCE_CONFIG).toEqual({
      minimumConfidence: 0.6,
      topKPerTarget: 5,
      maxCandidates: 5000,
      maxPairs: 50000,
      maxSchemaDepth: 12,
      maxElapsedMs: 5000,
      includeLowConfidence: true,
    })
  })

  test('rejects invalid configuration without throwing', async () => {
    const module = await api()
    const result = module.resolveInferenceConfig?.({
      minimumConfidence: 2,
      topKPerTarget: 0,
      maxCandidates: -1,
    })

    expect(result?.config).toBeUndefined()
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-INF-1001', severity: 'error' }),
    ])
  })

  test.each([
    ['reservationId', ['reservation', 'id'], 'reservation:id'],
    ['reservation_id', ['reservation', 'id'], 'reservation:id'],
    ['Reservation-ID', ['reservation', 'id'], 'reservation:id'],
    ['payload.customerID', ['payload', 'customer', 'id'], 'payload:customer:id'],
  ])('normalizes %s deterministically', async (value, tokens, signature) => {
    const module = await api()

    expect(module.normalizeFieldName?.(value)).toMatchObject({
      original: value,
      tokens,
      signature,
    })
  })

  test('marks generic IDs and secret-shaped names', async () => {
    const module = await api()

    expect(module.normalizeFieldName?.('id')).toMatchObject({ genericId: true })
    expect(module.normalizeFieldName?.('refreshToken')).toMatchObject({ secretLike: true })
    expect(module.normalizeFieldName?.('reservationId')).toMatchObject({
      genericId: false,
      secretLike: false,
    })
  })

  test('normalizes conservative resource segments', async () => {
    const module = await api()

    expect(module.normalizeResourceSegment?.('Reservations')).toBe('reservation')
    expect(module.normalizeResourceSegment?.('status')).toBe('status')
    expect(module.normalizeResourceSegment?.('{reservationId}')).toBe('')
  })
})
