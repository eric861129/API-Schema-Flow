import type { Diagnostic } from '@api-schema-flow/diagnostics'

import type { SourceDocument } from './source-document.js'
import type { SourceLocation } from './source-location.js'
import type { SourceBudget, SourceRetrievalPolicy } from './retrieval-policy.js'

export interface SourceAcquisitionContext {
  readonly policy: SourceRetrievalPolicy
  readonly budget: SourceBudget
  readonly depth?: number
  readonly parentUri?: string
}

export interface SourceAcquisitionResult {
  readonly source?: SourceDocument
  readonly diagnostics: readonly Diagnostic[]
}

export interface SourceAcquirer {
  acquire(
    location: SourceLocation,
    context: SourceAcquisitionContext,
  ): Promise<SourceAcquisitionResult>
}
