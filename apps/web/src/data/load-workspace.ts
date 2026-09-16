import type { Diagnostic } from '@api-schema-flow/diagnostics'
import {
  REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  isReviewWorkspaceSnapshot,
} from '@api-schema-flow/domain'

import type { WorkspaceSnapshot } from './types'

export class WorkspaceLoadError extends Error {
  constructor(
    readonly code: 'network' | 'invalid-json' | 'unsupported' | 'invalid-shape',
    message: string,
  ) {
    super(message)
    this.name = 'WorkspaceLoadError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSourcePointer(value: unknown): boolean {
  return isRecord(value) && typeof value.uri === 'string' && typeof value.pointer === 'string'
}

function isDiagnostic(value: unknown): value is Diagnostic {
  if (!isRecord(value)) return false

  return (
    typeof value.code === 'string' &&
    ['error', 'warning', 'info'].includes(String(value.severity)) &&
    typeof value.message === 'string' &&
    (value.source === undefined || isSourcePointer(value.source)) &&
    (value.details === undefined || isRecord(value.details))
  )
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  return isReviewWorkspaceSnapshot(value) && value.diagnostics.every(isDiagnostic)
}

export async function loadWorkspaceSnapshot(
  url = '/fixtures/reservation-workspace.json',
  fetcher: typeof fetch = fetch,
): Promise<WorkspaceSnapshot> {
  let response: Response
  try {
    response = await fetcher(url)
  } catch {
    throw new WorkspaceLoadError(
      'network',
      'The Reservation workspace could not be loaded. Check the local server and retry.',
    )
  }

  if (!response.ok) {
    throw new WorkspaceLoadError(
      'network',
      'The Reservation workspace returned HTTP ' + response.status + '.',
    )
  }

  let value: unknown
  try {
    value = await response.json()
  } catch {
    throw new WorkspaceLoadError('invalid-json', 'The workspace fixture is not valid JSON.')
  }

  if (!isRecord(value)) {
    throw new WorkspaceLoadError('invalid-shape', 'The workspace fixture root must be an object.')
  }

  if (!Object.hasOwn(value, 'schemaVersion')) {
    throw new WorkspaceLoadError(
      'invalid-shape',
      'The review workspace fixture does not match the Snapshot 1.1 contract.',
    )
  }

  if (value.schemaVersion !== REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION) {
    throw new WorkspaceLoadError(
      'unsupported',
      'This build requires review workspace snapshot 1.1, but received ' +
        String(value.schemaVersion) +
        '.',
    )
  }

  if (!isWorkspaceSnapshot(value)) {
    throw new WorkspaceLoadError(
      'invalid-shape',
      'The review workspace fixture does not match the Snapshot 1.1 contract.',
    )
  }

  return value
}
