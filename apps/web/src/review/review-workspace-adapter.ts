import type {
  FlowDataMapping,
  FlowValueSelector,
  FlowValueTarget,
  InferenceCandidate,
  NormalizedApiDocument,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedSchema,
  ReviewDecision,
  ReviewDecisionOutcome,
  ReviewDecisionOutcomeState,
  ReviewDecisionSet,
  SourcePointer,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import type { WorkspaceSnapshot } from '../data/types'
import { deriveBaselineRevisions } from './decision-factory'
import type { ReviewSessionMaterialization } from './review-engine'
import type {
  ReviewBlockerDetail,
  ReviewCandidateDetail,
  ReviewEvidenceDetail,
  ReviewSchemaDescriptor,
} from './review-detail'
import type { ReviewCandidateRow, ReviewCandidateState } from './review-selectors'

export interface ProjectedReviewCandidateDetail extends ReviewCandidateDetail {
  readonly outcomeState?: ReviewDecisionOutcomeState
  readonly outcomeReason?: string
  readonly sourcePointers: readonly string[]
  readonly schemaWarnings: readonly string[]
}

export interface ReviewWorkspaceProjection {
  readonly rows: readonly ReviewCandidateRow[]
  readonly details: ReadonlyMap<string, ProjectedReviewCandidateDetail>
  readonly baselineRevisions: Readonly<Record<string, number>>
}

export interface ReviewCandidateStateProjection {
  readonly state: ReviewCandidateState
  readonly outcomeState?: ReviewDecisionOutcomeState
  readonly outcomeReason?: string
}

interface SchemaMatch {
  readonly schema: NormalizedSchema
  readonly required: boolean
  readonly arrayDepth: number
}

interface SchemaResolution {
  readonly descriptor: ReviewSchemaDescriptor
  readonly warnings: readonly string[]
}

function formatSourcePointer(pointer: SourcePointer): string {
  return `${pointer.uri}${pointer.pointer}`
}

function operationLabel(operation: NormalizedOperation | undefined, fallback: string): string {
  return operation ? `${operation.method.toUpperCase()} ${operation.path}` : fallback
}

function selectorLabel(selector: FlowValueSelector): string {
  switch (selector.kind) {
    case 'request-header':
      return `$request.header.${selector.name}`
    case 'request-query':
      return `$request.query.${selector.name}`
    case 'request-path':
      return `$request.path.${selector.name}`
    case 'request-body':
      return `$request.body${selector.pointer}`
    case 'response-header':
      return `$response.header.${selector.name}`
    case 'response-body':
      return `$response.body${selector.pointer}`
    case 'status-code':
      return '$statusCode'
    case 'workflow-input':
      return `$inputs.${selector.name}`
    case 'literal':
      return JSON.stringify(selector.value)
  }
}

function targetLabel(target: FlowValueTarget): string {
  switch (target.kind) {
    case 'path-parameter':
      return `path.${target.name}`
    case 'query-parameter':
      return `query.${target.name}`
    case 'querystring-parameter':
      return `querystring.${target.name}`
    case 'header-parameter':
      return `header.${target.name}`
    case 'cookie-parameter':
      return `cookie.${target.name}`
    case 'request-body':
      return `requestBody${target.pointer}`
  }
}

function parsePointer(pointer: string): readonly string[] | undefined {
  if (pointer === '#') return []
  if (!pointer.startsWith('#/')) return undefined
  return pointer
    .slice(2)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function schemaKey(schema: NormalizedSchema): string {
  return `${schema.source.uri}\u0000${schema.source.pointer}`
}

function createSchemaResolver(document: NormalizedApiDocument) {
  const schemas = new Map<string, NormalizedSchema>()

  function visit(schema: NormalizedSchema, seen: Set<NormalizedSchema>): void {
    if (seen.has(schema)) return
    seen.add(schema)
    schemas.set(schemaKey(schema), schema)
    for (const child of Object.values(schema.properties)) visit(child, seen)
    if (schema.items) visit(schema.items, seen)
    for (const child of [...schema.allOf, ...schema.anyOf, ...schema.oneOf]) visit(child, seen)
    if (typeof schema.additionalProperties === 'object') visit(schema.additionalProperties, seen)
  }

  const seen = new Set<NormalizedSchema>()
  for (const component of document.componentSchemas) {
    schemas.set(`${component.source.uri}\u0000${component.source.pointer}`, component.schema)
    visit(component.schema, seen)
  }
  for (const operation of document.operations) {
    for (const parameter of operation.parameters) {
      if (parameter.schema) visit(parameter.schema, seen)
    }
    for (const media of operation.requestBody?.content ?? []) {
      if (media.schema) visit(media.schema, seen)
    }
    for (const response of operation.responses) {
      for (const media of response.content) {
        if (media.schema) visit(media.schema, seen)
      }
    }
  }

  return (pointer: SourcePointer): NormalizedSchema | undefined =>
    schemas.get(`${pointer.uri}\u0000${pointer.pointer}`)
}

function expandSchema(
  schema: NormalizedSchema,
  resolveSchema: (pointer: SourcePointer) => NormalizedSchema | undefined,
): readonly NormalizedSchema[] {
  const result: NormalizedSchema[] = []
  const seen = new Set<NormalizedSchema>()

  function visit(current: NormalizedSchema): void {
    if (seen.has(current)) return
    seen.add(current)
    result.push(current)
    if (current.resolvedRef) {
      const resolved = resolveSchema(current.resolvedRef)
      if (resolved) visit(resolved)
    }
    for (const nested of [...current.allOf, ...current.anyOf, ...current.oneOf]) visit(nested)
  }

  visit(schema)
  return result
}

function resolveSchemaPointer(
  schema: NormalizedSchema,
  pointer: string,
  resolveSchema: (pointer: SourcePointer) => NormalizedSchema | undefined,
): readonly SchemaMatch[] {
  const parsedTokens = parsePointer(pointer)
  if (!parsedTokens) return []
  const tokens = parsedTokens
  const matches: SchemaMatch[] = []
  const visited = new Set<string>()

  function walk(
    current: NormalizedSchema,
    index: number,
    arrayDepth: number,
    required: boolean,
  ): void {
    for (const variant of expandSchema(current, resolveSchema)) {
      const visitKey = `${schemaKey(variant)}\u0000${index}\u0000${arrayDepth}\u0000${required}`
      if (visited.has(visitKey)) continue
      visited.add(visitKey)

      if (index === tokens.length) {
        matches.push({ schema: variant, required, arrayDepth })
        continue
      }

      const token = tokens[index]!
      const property = variant.properties[token]
      if (property) {
        walk(property, index + 1, arrayDepth, variant.required.includes(token))
      }

      if (variant.items) {
        const consumesArrayIndex = /^(?:0|[1-9]\d*)$/u.test(token)
        walk(variant.items, consumesArrayIndex ? index + 1 : index, arrayDepth + 1, required)
      }
    }
  }

  walk(schema, 0, 0, false)
  const unique = new Map<string, SchemaMatch>()
  for (const match of matches) {
    const key = `${schemaKey(match.schema)}\u0000${match.required}\u0000${match.arrayDepth}`
    if (!unique.has(key)) unique.set(key, match)
  }
  return [...unique.values()].sort((left, right) => {
    return (
      schemaKey(left.schema).localeCompare(schemaKey(right.schema)) ||
      left.arrayDepth - right.arrayDepth ||
      Number(right.required) - Number(left.required)
    )
  })
}

function nonNullTypes(schema: NormalizedSchema): readonly string[] {
  return [...new Set(schema.types.filter((type) => type !== 'null'))].sort()
}

function collapseSchemaMatches(
  matches: readonly SchemaMatch[],
  ambiguousMessage: string,
  missingMessage: string,
): SchemaResolution {
  if (matches.length === 0) {
    return { descriptor: {}, warnings: [missingMessage] }
  }

  const signatures = new Set(
    matches.map(({ schema, arrayDepth }) =>
      JSON.stringify({ types: nonNullTypes(schema), format: schema.format, arrayDepth }),
    ),
  )
  if (signatures.size > 1) {
    return { descriptor: {}, warnings: [ambiguousMessage] }
  }

  const first = matches[0]!
  const types = nonNullTypes(first.schema)
  return {
    descriptor: {
      ...(types.length === 1 ? { type: types[0] } : {}),
      ...(first.schema.format ? { format: first.schema.format } : {}),
      ...(matches.every(({ required }) => required) ? { required: true } : {}),
      arrayDepth: first.arrayDepth,
    },
    warnings:
      types.length <= 1 ? [] : [`Schema exposes multiple possible types: ${types.join(', ')}.`],
  }
}

function successfulResponses(operation: NormalizedOperation) {
  const explicit = operation.responses.filter(({ statusCode }) => /^2\d\d$/u.test(statusCode))
  return (
    explicit.length > 0
      ? explicit
      : operation.responses.filter(({ statusCode }) => statusCode === 'default')
  ).toSorted((left, right) => left.statusCode.localeCompare(right.statusCode))
}

function matchingParameter(
  operation: NormalizedOperation,
  location: NormalizedParameter['location'],
  name: string,
): NormalizedParameter | undefined {
  const normalizedName = name.normalize('NFKC').toLocaleLowerCase()
  return operation.parameters
    .filter(
      (parameter) =>
        parameter.location === location &&
        parameter.name.normalize('NFKC').toLocaleLowerCase() === normalizedName,
    )
    .toSorted((left, right) =>
      formatSourcePointer(left.source).localeCompare(formatSourcePointer(right.source)),
    )[0]
}

function resolveSourceSchema(
  document: NormalizedApiDocument,
  operation: NormalizedOperation | undefined,
  selector: FlowValueSelector,
): SchemaResolution {
  if (!operation) return { descriptor: {}, warnings: ['Source operation is missing.'] }
  const resolver = createSchemaResolver(document)

  switch (selector.kind) {
    case 'response-body': {
      const matches = successfulResponses(operation).flatMap((response) =>
        response.content.flatMap((media) =>
          media.schema ? resolveSchemaPointer(media.schema, selector.pointer, resolver) : [],
        ),
      )
      return collapseSchemaMatches(
        matches,
        'Source schema is ambiguous across successful response variants.',
        'Source response schema could not be resolved.',
      )
    }
    case 'request-body': {
      const matches = (operation.requestBody?.content ?? []).flatMap((media) =>
        media.schema ? resolveSchemaPointer(media.schema, selector.pointer, resolver) : [],
      )
      return collapseSchemaMatches(
        matches,
        'Source request schema is ambiguous across media variants.',
        'Source request schema could not be resolved.',
      )
    }
    case 'request-header':
    case 'request-query':
    case 'request-path': {
      const location =
        selector.kind === 'request-header'
          ? 'header'
          : selector.kind === 'request-query'
            ? 'query'
            : 'path'
      const parameter = matchingParameter(operation, location, selector.name)
      return parameter?.schema
        ? collapseSchemaMatches(
            [{ schema: parameter.schema, required: parameter.required, arrayDepth: 0 }],
            'Source parameter schema is ambiguous.',
            'Source parameter schema could not be resolved.',
          )
        : { descriptor: {}, warnings: ['Source parameter schema could not be resolved.'] }
    }
    case 'response-header':
      return {
        descriptor: {},
        warnings: ['Normalized response headers do not expose schema metadata yet.'],
      }
    case 'status-code':
      return { descriptor: { type: 'integer', required: true, arrayDepth: 0 }, warnings: [] }
    case 'workflow-input':
      return { descriptor: {}, warnings: ['Workflow input schema is not part of this snapshot.'] }
    case 'literal': {
      const type =
        selector.value === null
          ? undefined
          : typeof selector.value === 'number'
            ? Number.isInteger(selector.value)
              ? 'integer'
              : 'number'
            : typeof selector.value
      return {
        descriptor: { ...(type ? { type } : {}), required: true, arrayDepth: 0 },
        warnings: type ? [] : ['Literal null has no concrete schema type.'],
      }
    }
  }
}

function resolveTargetSchema(
  document: NormalizedApiDocument,
  operation: NormalizedOperation | undefined,
  target: FlowValueTarget,
): SchemaResolution {
  if (!operation) return { descriptor: {}, warnings: ['Target operation is missing.'] }
  const resolver = createSchemaResolver(document)

  if (target.kind === 'request-body') {
    const matches = (operation.requestBody?.content ?? []).flatMap((media) =>
      media.schema ? resolveSchemaPointer(media.schema, target.pointer, resolver) : [],
    )
    return collapseSchemaMatches(
      matches,
      'Target schema is ambiguous across request media variants.',
      'Target request schema could not be resolved.',
    )
  }

  const locationByKind = {
    'path-parameter': 'path',
    'query-parameter': 'query',
    'querystring-parameter': 'querystring',
    'header-parameter': 'header',
    'cookie-parameter': 'cookie',
  } as const
  const parameter = matchingParameter(operation, locationByKind[target.kind], target.name)
  if (parameter?.schema) {
    return collapseSchemaMatches(
      [{ schema: parameter.schema, required: parameter.required, arrayDepth: 0 }],
      'Target parameter schema is ambiguous.',
      'Target parameter schema could not be resolved.',
    )
  }

  if (
    target.kind === 'header-parameter' &&
    target.name.normalize('NFKC').toLocaleLowerCase() === 'authorization' &&
    operation.security.length > 0
  ) {
    return { descriptor: { type: 'string', required: true, arrayDepth: 0 }, warnings: [] }
  }

  return { descriptor: {}, warnings: ['Target parameter schema could not be resolved.'] }
}

function findDecision(
  decisionSet: ReviewDecisionSet,
  decisionId: string,
): ReviewDecision | undefined {
  return decisionSet.decisions.find((decision) => decision.id === decisionId)
}

function conflictForCandidate(candidateId: string, diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.code === DIAGNOSTIC_CODES.REVIEW_DECISION_CONFLICT &&
      diagnostic.details?.candidateId === candidateId,
  )
}

function firstOutcome(
  outcomes: readonly ReviewDecisionOutcome[],
  state: ReviewDecisionOutcomeState,
): ReviewDecisionOutcome | undefined {
  return outcomes.find((outcome) => outcome.state === state)
}

export function resolveReviewCandidateState(
  candidateId: string,
  decisionSet: ReviewDecisionSet,
  outcomes: readonly ReviewDecisionOutcome[],
  diagnostics: readonly Diagnostic[],
): ReviewCandidateStateProjection {
  const candidateOutcomes = outcomes.filter((outcome) => outcome.candidateId === candidateId)

  if (conflictForCandidate(candidateId, diagnostics)) return { state: 'conflict' }
  for (const [outcomeState, state] of [
    ['invalid', 'invalid'],
    ['stale', 'stale'],
    ['orphaned', 'orphaned'],
  ] as const) {
    const matching = firstOutcome(candidateOutcomes, outcomeState)
    if (matching) {
      return {
        state,
        outcomeState: matching.state,
        ...(matching.reason ? { outcomeReason: matching.reason } : {}),
      }
    }
  }

  const active = candidateOutcomes
    .filter(({ state }) => ['applied', 'already-present', 'rejected'].includes(state))
    .map((outcome) => ({ outcome, decision: findDecision(decisionSet, outcome.decisionId) }))
    .filter(
      (entry): entry is { outcome: ReviewDecisionOutcome; decision: ReviewDecision } =>
        entry.decision !== undefined,
    )
    .toSorted(
      (left, right) =>
        right.decision.revision - left.decision.revision ||
        left.decision.id.localeCompare(right.decision.id),
    )[0]

  if (active) {
    const state =
      active.decision.action === 'edit'
        ? 'edited'
        : active.decision.action === 'reject'
          ? 'rejected'
          : 'accepted'
    return {
      state,
      outcomeState: active.outcome.state,
      ...(active.outcome.reason ? { outcomeReason: active.outcome.reason } : {}),
    }
  }

  const superseded = firstOutcome(candidateOutcomes, 'superseded')
  return superseded
    ? {
        state: 'superseded',
        outcomeState: superseded.state,
        ...(superseded.reason ? { outcomeReason: superseded.reason } : {}),
      }
    : { state: 'pending' }
}

function evidenceDetail(candidate: InferenceCandidate): readonly ReviewEvidenceDetail[] {
  return candidate.evidence.map((evidence) => ({
    ruleId: evidence.ruleId,
    kind:
      evidence.kind === 'positive'
        ? 'positive'
        : evidence.kind === 'penalty'
          ? 'negative'
          : 'neutral',
    weight: evidence.weight,
    summary: evidence.message,
    sourcePointers: evidence.sourcePointers.map(formatSourcePointer).toSorted(),
  }))
}

function blockerDetail(candidate: InferenceCandidate): readonly ReviewBlockerDetail[] {
  return candidate.blockers.map((blocker) => ({
    code: blocker.ruleId,
    summary: blocker.message,
    sourcePointers: blocker.sourcePointers.map(formatSourcePointer).toSorted(),
  }))
}

function aliasLabel(mapping: FlowDataMapping): string | undefined {
  const aliases = mapping.aliases
    .map(({ workflowId, stepId, outputName }) => `${workflowId}.${stepId}.${outputName}`)
    .toSorted()
  return aliases.length > 0 ? aliases.join(', ') : undefined
}

function rowFromDetail(detail: ProjectedReviewCandidateDetail): ReviewCandidateRow {
  return {
    id: detail.id,
    sourceOperationKey: detail.sourceOperationKey,
    sourceLabel: detail.sourceLabel,
    sourceSelector: detail.sourceSelector,
    targetOperationKey: detail.targetOperationKey,
    targetLabel: detail.targetLabel,
    targetDescriptor: detail.targetDescriptor,
    confidence: detail.confidence,
    band: detail.band,
    evidenceCount: detail.evidenceCount,
    blockerCount: detail.blockerCount,
    state: detail.state,
  }
}

export function projectReviewWorkspace(
  snapshot: WorkspaceSnapshot,
  materialization: ReviewSessionMaterialization,
): ReviewWorkspaceProjection {
  const operations = new Map(
    snapshot.apiDocument.operations.map((operation) => [operation.id, operation]),
  )
  const details = new Map<string, ProjectedReviewCandidateDetail>()

  for (const candidate of [...snapshot.inferenceCandidates].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const sourceOperation = operations.get(candidate.sourceOperationKey)
    const targetOperation = operations.get(candidate.targetOperationKey)
    const sourceSchema = resolveSourceSchema(
      snapshot.apiDocument,
      sourceOperation,
      candidate.mapping.source,
    )
    const targetSchema = resolveTargetSchema(
      snapshot.apiDocument,
      targetOperation,
      candidate.mapping.target,
    )
    const state = resolveReviewCandidateState(
      candidate.id,
      materialization.decisionSet,
      materialization.result.outcomes,
      materialization.result.diagnostics,
    )
    const evidence = evidenceDetail(candidate)
    const blockers = blockerDetail(candidate)
    const alias = aliasLabel(candidate.mapping)
    const transform = candidate.mapping.transform?.raw
    const detail: ProjectedReviewCandidateDetail = {
      id: candidate.id,
      sourceOperationKey: candidate.sourceOperationKey,
      sourceLabel: operationLabel(sourceOperation, candidate.sourceOperationKey),
      sourceSelector: selectorLabel(candidate.mapping.source),
      targetOperationKey: candidate.targetOperationKey,
      targetLabel: operationLabel(targetOperation, candidate.targetOperationKey),
      targetDescriptor: targetLabel(candidate.mapping.target),
      confidence: candidate.confidence,
      band: candidate.band,
      evidenceCount: evidence.length,
      blockerCount: blockers.length,
      state: state.state,
      ruleSetVersion: candidate.ruleSetVersion,
      fingerprint: candidate.fingerprint,
      sourceSchema: sourceSchema.descriptor,
      targetSchema: targetSchema.descriptor,
      ...(alias ? { alias } : {}),
      ...(transform ? { transform } : {}),
      evidence,
      blockers,
      ...(state.outcomeState ? { outcomeState: state.outcomeState } : {}),
      ...(state.outcomeReason ? { outcomeReason: state.outcomeReason } : {}),
      sourcePointers: candidate.mapping.sourcePointers.map(formatSourcePointer).toSorted(),
      schemaWarnings: [...sourceSchema.warnings, ...targetSchema.warnings],
    }
    details.set(candidate.id, detail)
  }

  return {
    rows: [...details.values()].map(rowFromDetail),
    details,
    baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
  }
}
