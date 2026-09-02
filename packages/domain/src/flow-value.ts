import type { SourcePointer } from './source-pointer.js'

export type FlowLiteralValue = string | number | boolean | null

export type FlowValueSelector =
  | { readonly kind: 'request-header'; readonly name: string }
  | { readonly kind: 'request-query'; readonly name: string }
  | { readonly kind: 'request-path'; readonly name: string }
  | { readonly kind: 'request-body'; readonly pointer: string }
  | { readonly kind: 'response-header'; readonly name: string }
  | { readonly kind: 'response-body'; readonly pointer: string }
  | { readonly kind: 'status-code' }
  | { readonly kind: 'workflow-input'; readonly name: string }
  | { readonly kind: 'literal'; readonly value: FlowLiteralValue }

export type FlowValueTarget =
  | { readonly kind: 'path-parameter'; readonly name: string }
  | { readonly kind: 'query-parameter'; readonly name: string }
  | { readonly kind: 'querystring-parameter'; readonly name: string }
  | { readonly kind: 'header-parameter'; readonly name: string }
  | { readonly kind: 'cookie-parameter'; readonly name: string }
  | { readonly kind: 'request-body'; readonly pointer: string }

export interface FlowValueAlias {
  readonly kind: 'step-output'
  readonly workflowId: string
  readonly stepId: string
  readonly outputName: string
}

export interface FlowTemplateTransform {
  readonly kind: 'template'
  readonly raw: string
}

export type FlowValueTransform = FlowTemplateTransform

export interface FlowDataMapping {
  readonly id: string
  readonly source: FlowValueSelector
  readonly target: FlowValueTarget
  readonly aliases: readonly FlowValueAlias[]
  readonly transform?: FlowValueTransform
  readonly sourcePointers: readonly SourcePointer[]
}
