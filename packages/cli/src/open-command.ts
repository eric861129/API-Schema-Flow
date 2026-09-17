import { fileURLToPath } from 'node:url'
import type { CliIo } from './run-cli.js'

export const OPEN_USAGE =
  'Usage: schema-flow open <local-openapi-file> [--project <local-project.json>] [--port <1-65535>]'

export async function executeOpenCommand(args: readonly string[], io: CliIo): Promise<number> {
  const [file, ...options] = args
  let port = 4318
  let projectFile: string | undefined
  let valid = Boolean(file && !file.startsWith('-') && !/^\w+:\/\//.test(file))
  const seen = new Set<string>()
  for (let index = 0; index < options.length; index += 2) {
    const flag = options[index]
    const value = options[index + 1]
    if (!flag || !value || seen.has(flag) || value.startsWith('--')) {
      valid = false
      break
    }
    seen.add(flag)
    if (flag === '--port') port = Number(value)
    else if (flag === '--project' && !/^\w+:\/\//.test(value)) projectFile = value
    else valid = false
  }
  if (!file || !valid || !Number.isInteger(port) || port < 1 || port > 65535) {
    io.stderr(OPEN_USAGE + '\n')
    return 2
  }
  const { importWorkspace } = await import('./workspace-import.js')
  const { startWorkspaceServer } = await import('./workspace-server.js')
  const snapshot = await importWorkspace(file)
  const projectText = projectFile
    ? await (await import('./project-reopen.js')).readProjectForWorkspace(projectFile, snapshot)
    : undefined
  const webRoot = fileURLToPath(new URL('../../../apps/web/dist/', import.meta.url))
  const { url } = await startWorkspaceServer(snapshot, webRoot, port, projectText)
  io.stdout(
    `Imported ${snapshot.apiDocument.operations.length} operations; ${snapshot.inferenceCandidates.length} candidates.\nOpen this local URL: ${url}\nKeep this process running. Ctrl+C stops the workspace. Reopen the same source and port to restore local decisions, or pass --project with a saved Project JSON to review its contents before applying.\n`,
  )
  return 0
}
