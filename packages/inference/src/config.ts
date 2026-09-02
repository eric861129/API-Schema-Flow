import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import type { InferenceConfig, ResolvedInferenceConfig } from './contracts.js'

export const INFERENCE_RULE_SET_VERSION = 'm2c-v1' as const

export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = Object.freeze({
  minimumConfidence: 0.6,
  topKPerTarget: 5,
  maxCandidates: 5_000,
  maxPairs: 50_000,
  maxSchemaDepth: 12,
  maxElapsedMs: 5_000,
  includeLowConfidence: true,
})

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function resolveInferenceConfig(
  partial: Partial<InferenceConfig> = {},
): ResolvedInferenceConfig {
  const config: InferenceConfig = {
    ...DEFAULT_INFERENCE_CONFIG,
    ...partial,
  }
  const invalid: string[] = []

  if (
    !Number.isFinite(config.minimumConfidence) ||
    config.minimumConfidence < 0 ||
    config.minimumConfidence > 1
  ) {
    invalid.push('minimumConfidence')
  }
  for (const key of [
    'topKPerTarget',
    'maxCandidates',
    'maxPairs',
    'maxSchemaDepth',
    'maxElapsedMs',
  ] as const) {
    if (!positiveInteger(config[key])) invalid.push(key)
  }
  if (typeof config.includeLowConfidence !== 'boolean') {
    invalid.push('includeLowConfidence')
  }

  if (invalid.length === 0) return { config, diagnostics: [] }

  const diagnostic: Diagnostic = {
    code: DIAGNOSTIC_CODES.INFERENCE_INPUT_INVALID,
    severity: 'error',
    message: 'Inference configuration is invalid.',
    details: { invalidFields: invalid.sort() },
  }
  return { diagnostics: [diagnostic] }
}
