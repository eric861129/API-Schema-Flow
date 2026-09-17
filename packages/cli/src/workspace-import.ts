import { createHash } from 'node:crypto'
import path from 'node:path'

import type { ReviewWorkspaceSnapshot } from '@api-schema-flow/domain'
import {
  DIAGNOSTIC_CODES,
  hasDiagnosticErrors,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import { buildDeclaredFlowGraphs } from '@api-schema-flow/flow'
import { inferFlowCandidates } from '@api-schema-flow/inference'
import { processOpenApiLocation } from '@api-schema-flow/openapi'
import { materializeReviewedOperationGraph } from '@api-schema-flow/review'
import { createSourceRetrievalPolicy, type SourceAcquirer } from '@api-schema-flow/source-loader'
import { createNodeSourceAcquirer } from '@api-schema-flow/source-loader/node'

/** 沿用正式解析與推論核心；本機工作區不取得遠端參照、不呼叫業務 API。 */
export async function importWorkspace(file: string): Promise<ReviewWorkspaceSnapshot<Diagnostic>> {
  const target = path.resolve(file)
  const node = createNodeSourceAcquirer()
  const acquirer: SourceAcquirer = {
    ...(node.resolveLocation ? { resolveLocation: node.resolveLocation.bind(node) } : {}),
    acquire(location, context) {
      if (location.kind !== 'file')
        return Promise.resolve({
          diagnostics: [
            {
              code: 'ASF-OPEN-LOCAL-ONLY',
              severity: 'error',
              message:
                'Workspace import supports local files only. Bundle remote references first.',
            },
          ],
        })
      return node.acquire(location, context)
    },
  }
  const parsed = await processOpenApiLocation(
    { kind: 'file', path: target },
    {
      acquirer,
      policy: createSourceRetrievalPolicy({ allowedFileRoots: [path.dirname(target)] }),
    },
  )
  if (!parsed.document || hasDiagnosticErrors(parsed.diagnostics))
    throw new Error(
      'OpenAPI import failed: ' +
        parsed.diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => d.code)
          .join(', '),
    )
  // 移除範例與預設值，不改動 schema 欄位名稱或型別。原始規格仍只留在來源檔。
  const apiDocument: typeof parsed.document = JSON.parse(
    JSON.stringify(parsed.document, (_key, value) => {
      if (
        value &&
        typeof value === 'object' &&
        value.source &&
        (Array.isArray(value.types) || typeof value.mediaType === 'string')
      ) {
        const clean = { ...value }
        delete clean.example
        delete clean.defaultValue
        return clean
      }
      return value
    }),
  )
  const source = { sourceId: 'cli', sourceName: apiDocument.info.title, document: apiDocument }
  const declared = buildDeclaredFlowGraphs({ openApiSources: [source] })
  if (hasDiagnosticErrors(declared.diagnostics))
    throw new Error('Cannot build the declared operation graph.')
  const inferred = inferFlowCandidates({
    openApiSources: [source],
    declaredOperationGraph: declared.operationGraph,
  })
  if (hasDiagnosticErrors(inferred.diagnostics)) throw new Error('Cannot infer review candidates.')
  // 時間截斷不可重現，不能使用相同來源識別保存不完整候選。
  if (inferred.diagnostics.some((d) => d.code === DIAGNOSTIC_CODES.INFERENCE_TIME_LIMIT))
    throw new Error('Inference timed out. Retry before saving a workspace for this source.')
  if (!apiDocument.fingerprint) throw new Error('OpenAPI source fingerprint is missing.')
  const reviewDecisionSet = {
    schemaVersion: '1.0' as const,
    revision: 0,
    decisions: [],
    manualEdges: [],
  }
  const reviewed = materializeReviewedOperationGraph({
    declaredOperationGraph: declared.operationGraph,
    candidates: inferred.candidates,
    decisionSet: reviewDecisionSet,
  })
  if (hasDiagnosticErrors(reviewed.diagnostics))
    throw new Error('Cannot initialize review decisions.')
  return {
    schemaVersion: '1.1',
    generatedBy: { package: 'api-schema-flow', milestone: 'M3-B1' },
    project: {
      name: apiDocument.info.title,
      sourceName: path.basename(target),
      sourceUri: apiDocument.sourceUri,
      openapiVersion: apiDocument.openapiVersion,
    },
    reviewContext: {
      projectFingerprint:
        'project:' + createHash('sha256').update(apiDocument.sourceUri).digest('hex'),
      sourceRevision: apiDocument.fingerprint,
    },
    apiDocument,
    declaredGraph: declared.operationGraph,
    acceptedGraph: reviewed.graph,
    inferenceCandidates: inferred.candidates,
    reviewDecisionSet,
    reviewOutcomes: reviewed.outcomes,
    diagnostics: [
      ...parsed.diagnostics,
      ...declared.diagnostics,
      ...inferred.diagnostics,
      ...reviewed.diagnostics,
    ],
  }
}
