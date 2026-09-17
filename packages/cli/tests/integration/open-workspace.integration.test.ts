import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { request } from 'node:http'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { importWorkspace } from '../../src/workspace-import.js'
import { startWorkspaceServer } from '../../src/workspace-server.js'

const fixture = fileURLToPath(
  new URL('../../../../examples/reservation/openapi.yaml', import.meta.url),
)

describe('local workspace import and server', () => {
  test('reimports stable source and candidates without accepting suggestions', async () => {
    const first = await importWorkspace(fixture)
    const second = await importWorkspace(fixture)
    expect(first.apiDocument.operations).toHaveLength(4)
    expect(first.reviewContext).toEqual(second.reviewContext)
    expect(first.inferenceCandidates).toEqual(second.inferenceCandidates)
    expect(first.reviewDecisionSet.decisions).toEqual([])
    expect(first.acceptedGraph.edges).toEqual(first.declaredGraph.edges)
  })

  test('serves private snapshot only to authenticated local requests and survives malformed URLs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'asf-open-'))
    await writeFile(path.join(root, 'index.html'), '<title>Workspace</title>')
    const snapshot = await importWorkspace(fixture)
    const { server, url } = await startWorkspaceServer(snapshot, root, 0)
    const address = new URL(url)
    const authorization = 'Bearer ' + new URLSearchParams(address.hash.slice(1)).get('workspace')
    const get = (pathname: string, headers = {}, method = 'GET') =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = request(
          { hostname: address.hostname, port: address.port, path: pathname, headers, method },
          (res) => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', (chunk) => {
              body += chunk
            })
            res.on('end', () => resolve({ status: res.statusCode!, body }))
          },
        )
        req.on('error', reject)
        req.end()
      })
    try {
      expect((await get('/')).status).toBe(200)
      expect((await get('/api/workspace')).status).toBe(403)
      expect((await get('/api/workspace', { authorization: 'Bearer wrong' })).status).toBe(403)
      expect(
        (await get('/api/workspace', { authorization, origin: 'https://other.example' })).status,
      ).toBe(403)
      expect((await get('/api/workspace', { authorization, host: 'other.example' })).status).toBe(
        403,
      )
      expect((await get('/api/workspace', { authorization }, 'POST')).status).toBe(405)
      expect((await get('/../secret.json')).status).toBe(404)
      expect((await get('http://[')).status).toBe(400)
      const result = await get('/api/workspace', { authorization })
      expect(result.status).toBe(200)
      expect(JSON.parse(result.body).reviewContext).toEqual(snapshot.reviewContext)
      expect((await get('/api/workspace', { authorization }, 'HEAD')).body).toBe('')
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })

  test('rejects remote references instead of fetching them', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'asf-open-source-'))
    const file = path.join(root, 'openapi.json')
    await writeFile(
      file,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Local', version: '1' },
        paths: {
          '/items': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': { schema: { $ref: 'https://example.invalid/schema.json' } },
                  },
                },
              },
            },
          },
        },
      }),
    )
    await expect(importWorkspace(file)).rejects.toThrow('OpenAPI import failed')
  })
})
