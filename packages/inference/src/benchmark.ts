import type {
  FlowValueSelector,
  FlowValueTarget,
  InferenceCandidate,
  InferenceConfidenceBand,
  InferenceReport,
} from '@api-schema-flow/domain'
import { canonicalizeJson } from '@api-schema-flow/flow'

export interface InferenceBenchmarkMapping {
  readonly sourceOperationKey: string
  readonly targetOperationKey: string
  readonly source: FlowValueSelector
  readonly target: FlowValueTarget
  readonly minimumBand?: InferenceConfidenceBand
  readonly reason?: string
}

export interface InferenceBenchmarkCase {
  readonly id: string
  readonly description: string
  readonly declaredLink: boolean
  readonly expectedPositiveMappings: readonly InferenceBenchmarkMapping[]
  readonly expectedNegativeMappings: readonly InferenceBenchmarkMapping[]
  readonly expectedSuppressedMappings?: readonly InferenceBenchmarkMapping[]
}

export interface InferenceBenchmarkCaseResult {
  readonly benchmarkCase: InferenceBenchmarkCase
  readonly report: InferenceReport
}

export interface InferenceBenchmarkReport {
  readonly highConfidencePrecision: number
  readonly mediumConfidencePrecision: number
  readonly recall: number
  readonly highTruePositiveCount: number
  readonly highFalsePositiveCount: number
  readonly mediumTruePositiveCount: number
  readonly mediumFalsePositiveCount: number
  readonly matchedPositiveCount: number
  readonly expectedPositiveCount: number
  readonly genericIdHighFalsePositives: number
  readonly declaredDuplicates: number
  readonly falsePositivesByRule: Readonly<Record<string, number>>
}

function mappingKey(mapping: InferenceBenchmarkMapping): string {
  return canonicalizeJson({
    sourceOperationKey: mapping.sourceOperationKey,
    targetOperationKey: mapping.targetOperationKey,
    source: mapping.source,
    target: mapping.target,
  })
}

function candidateKey(candidate: InferenceCandidate): string {
  return canonicalizeJson({
    sourceOperationKey: candidate.sourceOperationKey,
    targetOperationKey: candidate.targetOperationKey,
    source: candidate.mapping.source,
    target: candidate.mapping.target,
  })
}

function bandRank(band: InferenceConfidenceBand): number {
  switch (band) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
  }
}

function precision(truePositive: number, falsePositive: number): number {
  const total = truePositive + falsePositive
  return total === 0 ? 1 : truePositive / total
}

export function evaluateInferenceBenchmark(
  results: readonly InferenceBenchmarkCaseResult[],
): InferenceBenchmarkReport {
  let highTruePositiveCount = 0
  let highFalsePositiveCount = 0
  let mediumTruePositiveCount = 0
  let mediumFalsePositiveCount = 0
  let matchedPositiveCount = 0
  let expectedPositiveCount = 0
  let genericIdHighFalsePositives = 0
  let declaredDuplicates = 0
  const falsePositivesByRule = new Map<string, number>()

  for (const { benchmarkCase, report } of results) {
    const positives = new Map(
      benchmarkCase.expectedPositiveMappings.map((mapping) => [mappingKey(mapping), mapping]),
    )
    const negativeByKey = new Map(
      benchmarkCase.expectedNegativeMappings.map((mapping) => [mappingKey(mapping), mapping]),
    )
    const candidateByKey = new Map(report.candidates.map((candidate) => [candidateKey(candidate), candidate]))

    expectedPositiveCount += positives.size
    for (const [key, expected] of positives) {
      const candidate = candidateByKey.get(key)
      if (
        candidate !== undefined &&
        bandRank(candidate.band) >= bandRank(expected.minimumBand ?? 'low')
      ) {
        matchedPositiveCount += 1
      }
    }

    for (const candidate of report.candidates) {
      const key = candidateKey(candidate)
      const isPositive = positives.has(key)
      if (candidate.band === 'high') {
        if (isPositive) highTruePositiveCount += 1
        else highFalsePositiveCount += 1
      } else if (candidate.band === 'medium') {
        if (isPositive) mediumTruePositiveCount += 1
        else mediumFalsePositiveCount += 1
      }

      if (!isPositive && (candidate.band === 'high' || candidate.band === 'medium')) {
        for (const { ruleId } of candidate.evidence) {
          falsePositivesByRule.set(ruleId, (falsePositivesByRule.get(ruleId) ?? 0) + 1)
        }
      }

      if (
        candidate.band === 'high' &&
        negativeByKey.get(key)?.reason === 'generic-cross-resource-id'
      ) {
        genericIdHighFalsePositives += 1
      }
    }

    for (const suppressed of benchmarkCase.expectedSuppressedMappings ?? []) {
      if (candidateByKey.has(mappingKey(suppressed))) declaredDuplicates += 1
    }
  }

  return {
    highConfidencePrecision: precision(highTruePositiveCount, highFalsePositiveCount),
    mediumConfidencePrecision: precision(mediumTruePositiveCount, mediumFalsePositiveCount),
    recall: expectedPositiveCount === 0 ? 1 : matchedPositiveCount / expectedPositiveCount,
    highTruePositiveCount,
    highFalsePositiveCount,
    mediumTruePositiveCount,
    mediumFalsePositiveCount,
    matchedPositiveCount,
    expectedPositiveCount,
    genericIdHighFalsePositives,
    declaredDuplicates,
    falsePositivesByRule: Object.fromEntries(
      [...falsePositivesByRule.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  }
}
