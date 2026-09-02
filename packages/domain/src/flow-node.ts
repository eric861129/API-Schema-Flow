import type { HttpMethod } from './http-method.js'
import type { SourcePointer } from './source-pointer.js'

export interface EndpointFlowNode {
  readonly kind: 'endpoint'
  readonly id: string
  readonly sourceId: string
  readonly operationKey: string
  readonly method: HttpMethod
  readonly path: string
  readonly operationId?: string
  readonly summary?: string
  readonly source: SourcePointer
}

export interface WorkflowStepFlowNode {
  readonly kind: 'workflow-step'
  readonly id: string
  readonly sourceId: string
  readonly workflowId: string
  readonly stepId: string
  readonly operationKey?: string
  readonly operationId?: string
  readonly operationPath?: string
  readonly source: SourcePointer
}

export type FlowNode = EndpointFlowNode | WorkflowStepFlowNode
