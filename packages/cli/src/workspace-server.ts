import { randomBytes } from 'node:crypto'
import { readFile, readdir, realpath } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import type { ReviewWorkspaceSnapshot } from '@api-schema-flow/domain'

/** 僅提供已建置的靜態資產與記憶體快照；不接受檔案路徑或任何寫入要求。 */
export async function startWorkspaceServer(
  snapshot: ReviewWorkspaceSnapshot,
  webRoot: string,
  port: number,
  projectText?: string,
) {
  const root = await realpath(webRoot)
  const assets = new Map<string, string>()
  async function collect(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await collect(file)
      else if (entry.isFile())
        assets.set('/' + path.relative(root, file).split(path.sep).join('/'), file)
    }
  }
  await collect(root)
  if (!assets.has('/index.html')) throw new Error('Web build missing. Run pnpm build first.')
  const content = JSON.stringify(snapshot)
  if (Buffer.byteLength(content) > 64 * 1024 * 1024)
    throw new Error('Workspace snapshot exceeds the 64 MB limit.')
  const token = randomBytes(32).toString('hex')
  let origin = ''
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    const finish = (status: number, text: string) => {
      response.writeHead(status)
      response.end(text)
    }
    if (
      request.headers.host !== new URL(origin).host ||
      (request.headers.origin && request.headers.origin !== origin)
    ) {
      finish(403, 'Forbidden origin')
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      finish(405, 'Read-only workspace')
      return
    }
    let url: URL
    try {
      url = new URL(request.url ?? '/', origin)
    } catch {
      finish(400, 'Invalid request URL')
      return
    }
    if (url.pathname === '/api/workspace' || url.pathname === '/api/project') {
      if (request.headers.authorization !== `Bearer ${token}`) {
        finish(403, 'Workspace token required')
        return
      }
      if (url.pathname === '/api/project' && projectText === undefined) {
        finish(404, 'No project was provided')
        return
      }
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      finish(
        200,
        request.method === 'HEAD'
          ? ''
          : url.pathname === '/api/project'
            ? (projectText ?? '')
            : content,
      )
      return
    }
    const file = assets.get(url.pathname === '/' ? '/index.html' : url.pathname)
    if (!file) {
      finish(404, 'Not found')
      return
    }
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    }
    response.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream')
    void readFile(file)
      .then((data) => {
        response.writeHead(200)
        response.end(request.method === 'HEAD' ? undefined : data)
      })
      .catch(() => finish(404, 'Not found'))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Cannot bind workspace'))
        return
      }
      origin = `http://127.0.0.1:${address.port}`
      server.removeListener('error', reject)
      resolve()
    })
  })
  return {
    server,
    url: `${origin}/#workspace=${token}${projectText === undefined ? '' : '&project=1'}`,
  }
}
