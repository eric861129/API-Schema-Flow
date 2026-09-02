import type { InferenceConfidenceBand } from '@api-schema-flow/domain'

export function confidenceForScore(
  score: number,
  options: { readonly genericOnly?: boolean } = {},
): number {
  let confidence: number
  if (score >= 80) confidence = 0.95
  else if (score >= 65) confidence = 0.88
  else if (score >= 50) confidence = 0.78
  else if (score >= 35) confidence = 0.68
  else confidence = Math.min(0.59, Math.max(0, score / 100))

  return options.genericOnly === true ? Math.min(0.59, confidence) : confidence
}

export function confidenceBand(
  confidence: number,
): InferenceConfidenceBand | undefined {
  if (confidence >= 0.9) return 'high'
  if (confidence >= 0.75) return 'medium'
  if (confidence >= 0.6) return 'low'
  return undefined
}
