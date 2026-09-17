import type { FlowGraph } from '@api-schema-flow/domain'
import type { CanonicalArazzoDocument } from '@api-schema-flow/exporter-arazzo'
import { prepareLocalMockWorkflow, type LocalMockPlan } from '@api-schema-flow/execution'

import type { WorkspaceSnapshot } from '../data/types'
import type { WorkflowDraft } from './workflow-draft'
import { exportWorkflowDraft } from './workflow-export'

/** 使用與下載相同的匯出邊界，確保本機執行沒有偷偷採用未接受的映射。 */
export async function prepareWorkflowRun(
  snapshot: WorkspaceSnapshot,
  graph: FlowGraph,
  draft: WorkflowDraft,
): Promise<{ readonly plan?: LocalMockPlan; readonly reason?: string }> {
  const artifact = await exportWorkflowDraft(snapshot, graph, draft, 'json')
  const error = artifact.diagnostics.find((diagnostic) => diagnostic.severity === 'error')
  if (error || !artifact.contents)
    return { reason: error?.message ?? 'Validate the workflow before running Local Mock.' }
  const document = JSON.parse(artifact.contents) as CanonicalArazzoDocument
  return prepareLocalMockWorkflow(document, snapshot.apiDocument.operations)
}
