import type { SourcePointer } from './source-pointer.js'

export interface NormalizedLinkMapping {
  readonly target: string
  readonly expression: string
}

export type NormalizedLinkTarget =
  | {
      readonly type: 'operationRef'
      readonly operationRef: string
    }
  | {
      readonly type: 'operationId'
      readonly operationId: string
    }

export interface NormalizedLink {
  readonly name: string
  readonly description?: string
  readonly target: NormalizedLinkTarget
  readonly resolvedOperationKey?: string
  readonly parameters: readonly NormalizedLinkMapping[]
  readonly requestBody?: unknown
  readonly source: SourcePointer
}
