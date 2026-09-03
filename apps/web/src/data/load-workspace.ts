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
  if (!response.ok)
    throw new WorkspaceLoadError(
      'network',
      'The Reservation workspace returned HTTP ' + response.status + '.',
    )
  let value: unknown
  try {
    value = await response.json()
  } catch {
    throw new WorkspaceLoadError('invalid-json', 'The workspace fixture is not valid JSON.')
  }
  if (!isRecord(value))
    throw new WorkspaceLoadError('invalid-shape', 'The workspace fixture root must be an object.')
  if (value.schemaVersion !== '1.0')
    throw new WorkspaceLoadError(
      'unsupported',
      'This build supports workspace snapshot 1.0, but received ' +
        String(value.schemaVersion) +
        '.',
    )
  if (
    !isRecord(value.apiDocument) ||
    !Array.isArray(value.apiDocument.operations) ||
    !isRecord(value.acceptedGraph) ||
    !Array.isArray(value.acceptedGraph.nodes) ||
    !Array.isArray(value.acceptedGraph.edges)
  ) {
    throw new WorkspaceLoadError(
      'invalid-shape',
      'The workspace fixture is missing operations or graph data.',
    )
  }
  return value as unknown as WorkspaceSnapshot
}
