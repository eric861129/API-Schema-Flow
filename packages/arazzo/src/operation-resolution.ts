import { sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import type { ArazzoOperationCatalog, ArazzoCatalogOperation } from './operation-catalog.js'
import type {
  ArazzoOperationTarget,
  NormalizedArazzoDocument,
  NormalizedArazzoStep,
} from './model.js'
import { resolveSourceDescriptionUris } from './source-resolution.js'

export type ArazzoOperationResolutionStatus =
  'resolved' | 'missing' | 'ambiguous' | 'type-mismatch' | 'preserve-only'

export interface ResolvedArazzoOperation {
  readonly workflowId: string
  readonly stepId: string
  readonly target: ArazzoOperationTarget
  readonly status: ArazzoOperationResolutionStatus
  readonly sourceName?: string
  readonly operationKey?: string
  readonly candidates?: readonly string[]
}

export interface ResolveArazzoOperationsResult {
  readonly resolutions: readonly ResolvedArazzoOperation[]
  readonly diagnostics: readonly Diagnostic[]
}

interface OperationCandidate {
  readonly catalog: ArazzoOperationCatalog
  readonly operation: ArazzoCatalogOperation
}

const QUALIFIED_OPERATION = /^\$sourceDescriptions\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/u
const SOURCE_OPERATION_PATH = /^\{\$sourceDescriptions\.([A-Za-z0-9_-]+)\.url\}(#.*)$/u

function orderedCandidates(candidates: readonly OperationCandidate[]): OperationCandidate[] {
  return [...candidates].sort(
    (left, right) =>
      left.operation.key.localeCompare(right.operation.key) ||
      left.catalog.sourceName.localeCompare(right.catalog.sourceName),
  )
}

function missingResolution(
  workflowId: string,
  step: NormalizedArazzoStep,
  target: ArazzoOperationTarget,
  diagnostics: Diagnostic[],
): ResolvedArazzoOperation {
  diagnostics.push({
    code: 'ASF-ARZ-1014',
    severity: 'error',
    message: `Step "${step.stepId}" operation target could not be resolved.`,
    source: step.source,
    details: { workflowId, stepId: step.stepId, target },
  })
  return { workflowId, stepId: step.stepId, target, status: 'missing' }
}

function ambiguousResolution(
  workflowId: string,
  step: NormalizedArazzoStep,
  target: ArazzoOperationTarget,
  candidates: readonly OperationCandidate[],
  diagnostics: Diagnostic[],
): ResolvedArazzoOperation {
  const operationKeys = orderedCandidates(candidates).map(({ operation }) => operation.key)
  diagnostics.push({
    code: 'ASF-ARZ-1015',
    severity: 'error',
    message: `Step "${step.stepId}" operation target is ambiguous.`,
    source: step.source,
    details: { workflowId, stepId: step.stepId, target, candidates: operationKeys },
  })
  return {
    workflowId,
    stepId: step.stepId,
    target,
    status: 'ambiguous',
    candidates: operationKeys,
  }
}

function typeMismatchResolution(
  workflowId: string,
  step: NormalizedArazzoStep,
  target: ArazzoOperationTarget,
  catalog: ArazzoOperationCatalog,
  diagnostics: Diagnostic[],
): ResolvedArazzoOperation {
  diagnostics.push({
    code: 'ASF-ARZ-1016',
    severity: 'error',
    message: `Step "${step.stepId}" uses an OpenAPI operation target with source type "${catalog.sourceType}".`,
    source: step.source,
    details: {
      workflowId,
      stepId: step.stepId,
      sourceName: catalog.sourceName,
      sourceType: catalog.sourceType,
    },
  })
  return {
    workflowId,
    stepId: step.stepId,
    target,
    status: 'type-mismatch',
    sourceName: catalog.sourceName,
  }
}

function resolved(
  workflowId: string,
  step: NormalizedArazzoStep,
  target: ArazzoOperationTarget,
  candidate: OperationCandidate,
): ResolvedArazzoOperation {
  return {
    workflowId,
    stepId: step.stepId,
    target,
    status: 'resolved',
    sourceName: candidate.catalog.sourceName,
    operationKey: candidate.operation.key,
  }
}

function resolveOperationId(
  workflowId: string,
  step: NormalizedArazzoStep,
  target: Extract<ArazzoOperationTarget, { readonly type: 'operationId' }>,
  catalogs: readonly ArazzoOperationCatalog[],
  diagnostics: Diagnostic[],
): ResolvedArazzoOperation {
  const qualified = QUALIFIED_OPERATION.exec(target.operationId)
  let candidates: OperationCandidate[]
  if (qualified) {
    const sourceName = qualified[1]!
    const operationId = qualified[2]!
    const catalog = catalogs.find((entry) => entry.sourceName === sourceName)
    if (!catalog) return missingResolution(workflowId, step, target, diagnostics)
    if (catalog.sourceType.toLowerCase() !== 'openapi') {
      return typeMismatchResolution(workflowId, step, target, catalog, diagnostics)
    }
    candidates = catalog.operations
      .filter((operation) => operation.operationId === operationId)
      .map((operation) => ({ catalog, operation }))
  } else {
    candidates = catalogs.flatMap((catalog) =>
      catalog.operations
        .filter((operation) => operation.operationId === target.operationId)
        .map((operation) => ({ catalog, operation })),
    )
  }

  candidates = orderedCandidates(candidates)
  if (candidates.length === 0) return missingResolution(workflowId, step, target, diagnostics)
  if (candidates.length > 1) {
    return ambiguousResolution(workflowId, step, target, candidates, diagnostics)
  }
  const candidate = candidates[0]!
  if (candidate.catalog.sourceType.toLowerCase() !== 'openapi') {
    return typeMismatchResolution(workflowId, step, target, candidate.catalog, diagnostics)
  }
  return resolved(workflowId, step, target, candidate)
}

function resolveOperationPath(
  workflowId: string,
  step: NormalizedArazzoStep,
  target: Extract<ArazzoOperationTarget, { readonly type: 'operationPath' }>,
  catalogs: readonly ArazzoOperationCatalog[],
  diagnostics: Diagnostic[],
): ResolvedArazzoOperation {
  const sourcePath = SOURCE_OPERATION_PATH.exec(target.operationPath)
  if (!sourcePath) return missingResolution(workflowId, step, target, diagnostics)
  const sourceName = sourcePath[1]!
  const operationPath = sourcePath[2]!
  const catalog = catalogs.find((entry) => entry.sourceName === sourceName)
  if (!catalog) return missingResolution(workflowId, step, target, diagnostics)
  if (catalog.sourceType.toLowerCase() !== 'openapi') {
    return typeMismatchResolution(workflowId, step, target, catalog, diagnostics)
  }
  const candidates = catalog.operations
    .filter((operation) => operation.operationPath === operationPath)
    .map((operation) => ({ catalog, operation }))
  if (candidates.length === 0) return missingResolution(workflowId, step, target, diagnostics)
  if (candidates.length > 1) {
    return ambiguousResolution(workflowId, step, target, candidates, diagnostics)
  }
  return resolved(workflowId, step, target, candidates[0]!)
}

export function resolveArazzoOperations(
  document: NormalizedArazzoDocument,
  catalogs: readonly ArazzoOperationCatalog[],
  retrievalUri: string,
): ResolveArazzoOperationsResult {
  const diagnostics: Diagnostic[] = [
    ...resolveSourceDescriptionUris(document, retrievalUri).diagnostics,
  ]
  const declaredSourceNames = new Set(document.sourceDescriptions.map(({ name }) => name))
  const availableCatalogs = catalogs.filter((catalog) =>
    declaredSourceNames.has(catalog.sourceName),
  )
  const resolutions: ResolvedArazzoOperation[] = []

  for (const workflow of document.workflows) {
    for (const step of workflow.steps) {
      for (const target of step.targets) {
        switch (target.type) {
          case 'operationId':
            resolutions.push(
              resolveOperationId(workflow.workflowId, step, target, availableCatalogs, diagnostics),
            )
            break
          case 'operationPath':
            resolutions.push(
              resolveOperationPath(
                workflow.workflowId,
                step,
                target,
                availableCatalogs,
                diagnostics,
              ),
            )
            break
          case 'workflowId':
          case 'channelPath':
            resolutions.push({
              workflowId: workflow.workflowId,
              stepId: step.stepId,
              target,
              status: 'preserve-only',
            })
            break
        }
      }
    }
  }

  return { resolutions, diagnostics: sortDiagnostics(diagnostics) }
}
