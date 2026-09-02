// Public, framework-free entry point for deterministic M2-C inference.
export {
  DEFAULT_INFERENCE_CONFIG,
  INFERENCE_RULE_SET_VERSION,
  resolveInferenceConfig,
} from './config.js'
export {
  meaningfulOperationTokens,
  normalizeFieldName,
  normalizeResourceSegment,
  resourceKeyForPath,
} from './name-normalization.js'
export { extractOperationSourceFields, extractOperationTargetFields } from './schema-fields.js'
export {
  createDeclaredMappingIndex,
  declaredMappingKey,
  isDeclaredMapping,
} from './declared-suppression.js'
export {
  createInferenceCandidateId,
  createInferenceFingerprint,
  inferenceInputFingerprint,
} from './canonical.js'
export { wouldCreateDeclaredCycle } from './topology.js'
export {
  evaluateEvidenceRules,
  evaluateHardConstraints,
  evidenceScore,
  genericOnlyEvidence,
  plausibleInferencePair,
  schemaTypesCompatible,
} from './rules.js'
export { confidenceBand, confidenceForScore } from './scoring.js'
export { inferFlowCandidates } from './infer-flow-candidates.js'
export type {
  InferFlowCandidatesInput,
  InferenceConfig,
  InferenceFieldExtractionResult,
  InferenceOperationIndex,
  InferencePair,
  InferenceSourceField,
  InferenceTargetField,
  NormalizedInferenceName,
  ResolvedInferenceConfig,
} from './contracts.js'
