import type { SourcePointer } from '@api-schema-flow/domain'

import type { RuntimeExpression } from './runtime-expression.js'
import type { RuntimeTemplate } from './runtime-template.js'

export type PreservedRecord = Readonly<Record<string, unknown>>

export interface ArazzoPreservedObject {
  readonly source: SourcePointer
  readonly extensions: PreservedRecord
  readonly preservedFields: PreservedRecord
}

export interface NormalizedArazzoLiteralValue {
  readonly kind: 'literal'
  readonly value: unknown
  readonly source: SourcePointer
}

export interface NormalizedArazzoExpressionValue {
  readonly kind: 'expression'
  readonly expression: RuntimeExpression
  readonly source: SourcePointer
}

export interface NormalizedArazzoTemplateValue {
  readonly kind: 'template'
  readonly template: RuntimeTemplate
  readonly source: SourcePointer
}

export interface NormalizedArazzoArrayValue {
  readonly kind: 'array'
  readonly items: readonly NormalizedArazzoValue[]
  readonly source: SourcePointer
}

export interface NormalizedArazzoObjectValue {
  readonly kind: 'object'
  readonly properties: Readonly<Record<string, NormalizedArazzoValue>>
  readonly source: SourcePointer
}

export type NormalizedArazzoValue =
  | NormalizedArazzoLiteralValue
  | NormalizedArazzoExpressionValue
  | NormalizedArazzoTemplateValue
  | NormalizedArazzoArrayValue
  | NormalizedArazzoObjectValue

export interface NormalizedArazzoInfo extends ArazzoPreservedObject {
  readonly title: string
  readonly version: string
  readonly summary?: string
  readonly description?: string
}

export interface NormalizedArazzoSourceDescription extends ArazzoPreservedObject {
  readonly name: string
  readonly url: string
  readonly type: string
  readonly resolvedUri?: string
}

export type ArazzoOperationTarget =
  | { readonly type: 'operationId'; readonly operationId: string }
  | { readonly type: 'operationPath'; readonly operationPath: string }
  | { readonly type: 'workflowId'; readonly workflowId: string }
  | { readonly type: 'channelPath'; readonly channelPath: string }

export interface NormalizedArazzoParameter extends ArazzoPreservedObject {
  readonly name: string
  readonly location: string
  readonly value: NormalizedArazzoValue
  readonly description?: string
}

export interface NormalizedArazzoRequestBody extends ArazzoPreservedObject {
  readonly contentType?: string
  readonly payload: NormalizedArazzoValue
}

export interface NormalizedArazzoCriterion extends ArazzoPreservedObject {
  readonly condition: NormalizedArazzoValue
  readonly type?: string
  readonly context?: string
}

export interface NormalizedArazzoAction extends ArazzoPreservedObject {
  readonly name?: string
  readonly type?: string
  readonly stepId?: string
  readonly workflowId?: string
  readonly retry?: number
  readonly criteria: readonly NormalizedArazzoCriterion[]
}

export interface NormalizedArazzoStep extends ArazzoPreservedObject {
  readonly stepId: string
  readonly description?: string
  readonly targets: readonly ArazzoOperationTarget[]
  readonly parameters: readonly NormalizedArazzoParameter[]
  readonly requestBody?: NormalizedArazzoRequestBody
  readonly successCriteria: readonly NormalizedArazzoCriterion[]
  readonly onSuccess: readonly NormalizedArazzoAction[]
  readonly onFailure: readonly NormalizedArazzoAction[]
  readonly outputs: Readonly<Record<string, NormalizedArazzoValue>>
  readonly dependsOn: readonly string[]
  readonly timeout?: number
}

export interface NormalizedArazzoWorkflow extends ArazzoPreservedObject {
  readonly workflowId: string
  readonly summary?: string
  readonly description?: string
  readonly inputs?: NormalizedArazzoValue
  readonly parameters: readonly NormalizedArazzoParameter[]
  readonly steps: readonly NormalizedArazzoStep[]
  readonly successActions: readonly NormalizedArazzoAction[]
  readonly failureActions: readonly NormalizedArazzoAction[]
  readonly outputs: Readonly<Record<string, NormalizedArazzoValue>>
}

export interface NormalizedArazzoDocument extends ArazzoPreservedObject {
  readonly schemaVersion: '1.0'
  readonly sourceUri: string
  readonly arazzoVersion: string
  readonly self?: string
  readonly info: NormalizedArazzoInfo
  readonly sourceDescriptions: readonly NormalizedArazzoSourceDescription[]
  readonly workflows: readonly NormalizedArazzoWorkflow[]
  readonly components: NormalizedArazzoValue
}
