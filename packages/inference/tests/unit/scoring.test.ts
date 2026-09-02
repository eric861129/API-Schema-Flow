import { describe, expect, test } from 'vitest'

type ScoringApi = {
  readonly confidenceForScore?: (
    score: number,
    options?: { readonly genericOnly?: boolean },
  ) => number
  readonly confidenceBand?: (confidence: number) => 'high' | 'medium' | 'low' | undefined
}

async function api(): Promise<ScoringApi> {
  return (await import('../../src/index.js')) as ScoringApi
}

describe('inference scoring', () => {
  test.each([
    [80, 0.95, 'high'],
    [65, 0.88, 'medium'],
    [50, 0.78, 'medium'],
    [35, 0.68, 'low'],
    [20, 0.2, undefined],
  ])('maps score %s to confidence and band', async (score, confidence, band) => {
    const module = await api()
    const value = module.confidenceForScore?.(score)

    expect(value).toBe(confidence)
    expect(value === undefined ? undefined : module.confidenceBand?.(value)).toBe(band)
  })

  test('caps generic-only evidence below the reporting threshold', async () => {
    const module = await api()

    expect(module.confidenceForScore?.(90, { genericOnly: true })).toBe(0.59)
  })
})
