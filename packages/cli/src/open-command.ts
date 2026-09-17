import { fileURLToPath } from 'node:url'
import type { CliIo } from './run-cli.js'

export const OPEN_USAGE = 'Usage: schema-flow open <local-openapi-file> [--port <1-65535>]'

export async function executeOpenCommand(args: readonly string[], io: CliIo): Promise<number> {
  const [file, flag, value, ...extra] = args
  const port = value === undefined ? 4318 : Number(value)
  if (
    !file ||
    file.startsWith('-') ||
    /^\w+:\/\//.test(file) ||
    (flag !== undefined && (flag !== '--port' || !value)) ||
    extra.length ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    io.stderr(OPEN_USAGE + '\n')
    return 2
  }
  const { importWorkspace } = await import('./workspace-import.js')
  const { startWorkspaceServer } = await import('./workspace-server.js')
  const snapshot = await importWorkspace(file)
  const webRoot = fileURLToPath(new URL('../../../apps/web/dist/', import.meta.url))
  const { url } = await startWorkspaceServer(snapshot, webRoot, port)
  io.stdout(
    `Imported ${snapshot.apiDocument.operations.length} operations; ${snapshot.inferenceCandidates.length} candidates.\nOpen this local URL: ${url}\nKeep this process running. Ctrl+C stops the workspace. Reopen the same source and port to restore saved decisions.\n`,
  )
  return 0
}
