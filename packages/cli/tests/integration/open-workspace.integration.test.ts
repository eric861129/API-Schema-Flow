import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { request } from 'node:http'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { importWorkspace } from '../../src/workspace-import.js'
import { startWorkspaceServer } from '../../src/workspace-server.js'
import { readProjectForWorkspace } from '../../src/project-reopen.js'

const fixture = fileURLToPath(
  new URL('../../../../examples/reservation/openapi.yaml', import.meta.url),
)
const demoFixture = fileURLToPath(
  new URL('../../../../examples/demo-commerce/openapi.yaml', import.meta.url),
)

describe('local workspace import and server', () => {
  test('imports the fictional Commerce API with distinct groups and declared handoffs', async () => {
    const snapshot = await importWorkspace(demoFixture)
    expect(snapshot.project.name).toBe('Example Commerce API')
    expect(snapshot.apiDocument.operations).toHaveLength(13)
    expect(
      new Set(snapshot.apiDocument.operations.flatMap((operation) => operation.tags)).size,
    ).toBe(5)
    expect(snapshot.declaredGraph.edges.length).toBeGreaterThanOrEqual(3)
    const createOrder = snapshot.declaredGraph.nodes.find(
      (node) => node.kind === 'endpoint' && node.operationKey === 'operation:post:/orders',
    )
    const getOrder = snapshot.declaredGraph.nodes.find(
      (node) => node.kind === 'endpoint' && node.operationKey === 'operation:get:/orders/{id}',
    )
    expect(
      snapshot.declaredGraph.edges.some(
        (edge) => edge.sourceNodeId === createOrder?.id && edge.targetNodeId === getOrder?.id,
      ),
    ).toBe(true)
    expect(snapshot.reviewDecisionSet.decisions).toEqual([])
    expect(JSON.stringify(snapshot)).not.toMatch(/kcislk|kanchiao|academic-records/i)
  })

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
      expect((await get('/api/project', { authorization })).status).toBe(404)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })

  test('reopens only a matching Project JSON and serves it behind the workspace token', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'asf-project-'))
    await writeFile(path.join(root, 'index.html'), '<title>Workspace</title>')
    const snapshot = await importWorkspace(fixture)
    const backup = path.join(root, 'project.json')
    const project = JSON.stringify({
      kind: 'api-schema-flow-project',
      schemaVersion: '1.0',
      source: snapshot.reviewContext,
    })
    await writeFile(backup, project)
    expect(await readProjectForWorkspace(backup, snapshot)).toBe(project)
    await writeFile(
      backup,
      JSON.stringify({
        kind: 'api-schema-flow-project',
        schemaVersion: '1.0',
        source: { ...snapshot.reviewContext, sourceRevision: 'changed' },
      }),
    )
    await expect(readProjectForWorkspace(backup, snapshot)).rejects.toThrow('does not match')
    await writeFile(backup, project)
    const { server, url } = await startWorkspaceServer(
      snapshot,
      root,
      0,
      await readProjectForWorkspace(backup, snapshot),
    )
    const address = new URL(url)
    const token = new URLSearchParams(address.hash.slice(1)).get('workspace')
    try {
      expect(new URLSearchParams(address.hash.slice(1)).get('project')).toBe('1')
      const unauthenticated = await fetch(`${address.origin}/api/project`)
      expect(unauthenticated.status).toBe(403)
      const authenticated = await fetch(`${address.origin}/api/project`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(authenticated.status).toBe(200)
      expect(await authenticated.text()).toBe(project)
      expect(authenticated.headers.get('cache-control')).toBe('no-store')
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
