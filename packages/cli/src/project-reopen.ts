import { readFile, stat } from 'node:fs/promises'
import type { ReviewWorkspaceSnapshot } from '@api-schema-flow/domain'

const MAX_PROJECT_BYTES = 5 * 1024 * 1024

/** 重開前先核對來源版本，避免把備份交給錯誤的工作區。完整內容仍由網頁預覽並驗證。 */
export async function readProjectForWorkspace(
  file: string,
  snapshot: ReviewWorkspaceSnapshot,
): Promise<string> {
  if ((await stat(file)).size > MAX_PROJECT_BYTES)
    throw new Error('Project file exceeds the 5 MB limit.')
  const content = await readFile(file)
  if (content.byteLength > MAX_PROJECT_BYTES)
    throw new Error('Project file exceeds the 5 MB limit.')
  let value: unknown
  try {
    value = JSON.parse(content.toString('utf8'))
  } catch {
    throw new Error('Project file is not valid JSON.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Project JSON.')
  const project = value as Record<string, unknown>
  if (project.kind !== 'api-schema-flow-project' || project.schemaVersion !== '1.0')
    throw new Error('Unsupported project format or version.')
  const source = project.source
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw new Error('Project source does not match the loaded workspace.')
  const identity = source as Record<string, unknown>
  if (
    identity.projectFingerprint !== snapshot.reviewContext.projectFingerprint ||
    identity.sourceRevision !== snapshot.reviewContext.sourceRevision
  )
    throw new Error('Project source does not match the loaded workspace.')
  return content.toString('utf8')
}
