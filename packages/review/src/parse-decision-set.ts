import {
  REVIEW_DECISION_SCHEMA_VERSION,
  type FlowDataMapping,
  type FlowEdge,
  type ReviewDecision,
  type ReviewDecisionAction,
  type ReviewDecisionSet,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import { canonicalizeDecisionSet, createReviewDecisionId } from './canonical.js'
import type { ParseReviewDecisionSetResult } from './contracts.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isAction(value: unknown): value is ReviewDecisionAction {
  return value === 'accept' || value === 'reject' || value === 'edit'
}

function isSourcePointer(value: unknown): boolean {
  return isObject(value) && nonEmptyString(value.uri) && typeof value.pointer === 'string'
}

function isSelector(value: unknown): boolean {
  if (!isObject(value) || !nonEmptyString(value.kind)) return false
  switch (value.kind) {
    case 'request-header':
    case 'request-query':
    case 'request-path':
    case 'response-header':
    case 'workflow-input':
      return nonEmptyString(value.name)
    case 'request-body':
    case 'response-body':
      return typeof value.pointer === 'string'
    case 'status-code':
      return true
    case 'literal':
      return (
        value.value === null ||
        typeof value.value === 'string' ||
        typeof value.value === 'boolean' ||
        (typeof value.value === 'number' && Number.isFinite(value.value))
      )
    default:
      return false
  }
}

function isTarget(value: unknown): boolean {
  if (!isObject(value) || !nonEmptyString(value.kind)) return false
  switch (value.kind) {
    case 'path-parameter':
    case 'query-parameter':
    case 'querystring-parameter':
    case 'header-parameter':
    case 'cookie-parameter':
      return nonEmptyString(value.name)
    case 'request-body':
      return typeof value.pointer === 'string'
    default:
      return false
  }
}

function isAlias(value: unknown): boolean {
  return (
    isObject(value) &&
    value.kind === 'step-output' &&
    nonEmptyString(value.workflowId) &&
    nonEmptyString(value.stepId) &&
    nonEmptyString(value.outputName)
  )
}

function isMapping(value: unknown): value is FlowDataMapping {
  if (!isObject(value) || !nonEmptyString(value.id)) return false
  if (!isSelector(value.source) || !isTarget(value.target)) return false
  if (!Array.isArray(value.aliases) || !value.aliases.every(isAlias)) return false
  if (!Array.isArray(value.sourcePointers) || !value.sourcePointers.every(isSourcePointer)) {
    return false
  }
  return (
    value.transform === undefined ||
    (isObject(value.transform) &&
      value.transform.kind === 'template' &&
      typeof value.transform.raw === 'string')
  )
}

function isReviewMetadata(value: unknown): boolean {
  return (
    isObject(value) &&
    nonEmptyString(value.decisionId) &&
    (value.candidateId === undefined || nonEmptyString(value.candidateId)) &&
    (value.candidateFingerprint === undefined || nonEmptyString(value.candidateFingerprint)) &&
    (value.ruleSetVersion === undefined || nonEmptyString(value.ruleSetVersion)) &&
    (value.derivedFromCandidateId === undefined || nonEmptyString(value.derivedFromCandidateId)) &&
    Array.isArray(value.evidenceRuleIds) &&
    value.evidenceRuleIds.every(nonEmptyString)
  )
}

function isManualEdge(value: unknown): value is FlowEdge {
  return (
    isObject(value) &&
    nonEmptyString(value.id) &&
    value.kind === 'data' &&
    nonEmptyString(value.sourceNodeId) &&
    nonEmptyString(value.targetNodeId) &&
    value.provenance === 'manual' &&
    value.status === 'accepted' &&
    Array.isArray(value.mappings) &&
    value.mappings.length > 0 &&
    value.mappings.every(isMapping) &&
    Array.isArray(value.sourceStandardRefs) &&
    value.sourceStandardRefs.every(
      (reference) =>
        isObject(reference) &&
        (reference.standard === 'openapi-link' || reference.standard === 'arazzo') &&
        isSourcePointer(reference.source),
    ) &&
    (value.review === undefined || isReviewMetadata(value.review))
  )
}

function parseDecision(
  value: unknown,
  index: number,
  diagnostics: Diagnostic[],
): ReviewDecision | undefined {
  const source = { uri: 'memory://review-decisions', pointer: `#/decisions/${index}` }
  if (!isObject(value)) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_DECISION_INVALID,
      severity: 'error',
      message: `Review decision at index ${index} must be an object.`,
      source,
    })
    return undefined
  }

  const action = value.action
  const revision = value.revision
  const editedMapping = value.editedMapping
  const valid =
    value.schemaVersion === REVIEW_DECISION_SCHEMA_VERSION &&
    nonEmptyString(value.id) &&
    nonEmptyString(value.candidateId) &&
    nonEmptyString(value.candidateFingerprint) &&
    nonEmptyString(value.ruleSetVersion) &&
    Number.isInteger(revision) &&
    Number(revision) > 0 &&
    isAction(action) &&
    (value.decidedAt === undefined ||
      (nonEmptyString(value.decidedAt) && !Number.isNaN(Date.parse(value.decidedAt)))) &&
    (action === 'edit' ? isMapping(editedMapping) : editedMapping === undefined)

  if (!valid) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_DECISION_INVALID,
      severity: 'error',
      message: `Review decision at index ${index} is structurally invalid.`,
      source,
      details: { index },
    })
    return undefined
  }

  const parsedMapping = isMapping(editedMapping) ? editedMapping : undefined
  const parsed: ReviewDecision = {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    id: value.id as string,
    candidateId: value.candidateId as string,
    candidateFingerprint: value.candidateFingerprint as string,
    ruleSetVersion: value.ruleSetVersion as string,
    revision: revision as number,
    action,
    ...(parsedMapping === undefined ? {} : { editedMapping: parsedMapping }),
    ...(value.decidedAt === undefined ? {} : { decidedAt: value.decidedAt as string }),
  }

  const expectedId = createReviewDecisionId(parsed)
  if (parsed.id !== expectedId) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_DECISION_ID_MISMATCH,
      severity: 'error',
      message: `Review decision at index ${index} has an invalid deterministic identifier.`,
      source,
      details: { index },
    })
    return undefined
  }
  return parsed
}

export function parseReviewDecisionSet(input: unknown): ParseReviewDecisionSetResult {
  const diagnostics: Diagnostic[] = []
  if (!isObject(input) || input.schemaVersion !== REVIEW_DECISION_SCHEMA_VERSION) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.REVIEW_INPUT_INVALID,
          severity: 'error',
          message: 'Review decision set must use schema version 1.0.',
          source: { uri: 'memory://review-decisions', pointer: '#' },
        },
      ],
    }
  }
  if (!Number.isInteger(input.revision) || Number(input.revision) < 0) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_INPUT_INVALID,
      severity: 'error',
      message: 'Review decision set revision must be a non-negative integer.',
      source: { uri: 'memory://review-decisions', pointer: '#/revision' },
    })
  }
  if (!Array.isArray(input.decisions) || !Array.isArray(input.manualEdges)) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_INPUT_INVALID,
      severity: 'error',
      message: 'Review decision set decisions and manualEdges must be arrays.',
      source: { uri: 'memory://review-decisions', pointer: '#' },
    })
  }

  const decisions = Array.isArray(input.decisions)
    ? input.decisions.flatMap((value, index) => {
        const parsed = parseDecision(value, index, diagnostics)
        return parsed === undefined ? [] : [parsed]
      })
    : []
  const manualEdges = Array.isArray(input.manualEdges)
    ? input.manualEdges.flatMap((value, index) => {
        if (isManualEdge(value)) return [value]
        diagnostics.push({
          code: DIAGNOSTIC_CODES.REVIEW_MANUAL_EDGE_INVALID,
          severity: 'error',
          message: `Manual edge at index ${index} is structurally invalid.`,
          source: { uri: 'memory://review-decisions', pointer: `#/manualEdges/${index}` },
          details: { index },
        })
        return []
      })
    : []

  if (diagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: sortDiagnostics(diagnostics) }
  }

  const decisionSet: ReviewDecisionSet = canonicalizeDecisionSet({
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    revision: input.revision as number,
    decisions,
    manualEdges,
  })
  return { decisionSet, diagnostics: [] }
}
