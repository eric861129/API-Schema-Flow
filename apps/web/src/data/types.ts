import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { ReviewWorkspaceSnapshot } from '@api-schema-flow/domain'

export type WorkspaceSnapshot = ReviewWorkspaceSnapshot<Diagnostic>

export type SelectedElement = { readonly kind: 'node' | 'edge'; readonly id: string } | null
