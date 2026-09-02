import { readFile } from 'node:fs/promises'

import { describe, expect, test } from 'vitest'

import {
  evaluateInferenceBenchmark,
  type InferenceBenchmarkCase,
} from '../../src/benchmark.js'
import { inferFlowCandidates } from '../../src/index.js'
import { createInferenceInput } from '../helpers/fixture.js'

interface BenchmarkManifest {
  readonly schemaVersion: '1.0'
  readonly cases: readonly InferenceBenchmarkCase[]
}

async function manifest(): Promise<BenchmarkManifest> {
  const source = await readFile(
    new URL('../../../../fixtures/inference/benchmark/cases.json', import.meta.url),
    'utf8',
  )
  return JSON.parse(source) as BenchmarkManifest
}

describe('M2-C inference quality benchmark', () => {
  test('meets precision, recall, generic-ID, and declared-suppression gates', async () => {
    const benchmark = await manifest()
    const results = benchmark.cases.map((benchmarkCase) => {
      const { input } = createInferenceInput({ declaredLink: benchmarkCase.declaredLink })
      return {
        benchmarkCase,
        report: inferFlowCandidates(input),
      }
    })
    const report = evaluateInferenceBenchmark(results)

    expect(report.highConfidencePrecision).toBeGreaterThanOrEqual(0.85)
    expect(report.recall).toBe(1)
    expect(report.genericIdHighFalsePositives).toBe(0)
    expect(report.declaredDuplicates).toBe(0)
    expect(report.highFalsePositiveCount).toBe(0)
    expect(report.expectedPositiveCount).toBe(7)
    expect(report.matchedPositiveCount).toBe(7)
  })
})
