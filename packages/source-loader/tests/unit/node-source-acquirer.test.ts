import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'

import * as sourceLoader from '../../src/index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

async function loadNodeModule(): Promise<Record<string, unknown>> {
  const modulePath = '../../src/node-source-acquirer.js'
  return (await import(modulePath).catch(() => ({}))) as Record<string, unknown>
}

function policyAndBudget(overrides: Record<string, unknown>) {
  const createSourceRetrievalPolicy = Reflect.get(sourceLoader, 'createSourceRetrievalPolicy')
  const createSourceBudget = Reflect.get(sourceLoader, 'createSourceBudget')
  expect(createSourceRetrievalPolicy).toEqual(expect.any(Function))
  expect(createSourceBudget).toEqual(expect.any(Function))
  if (
    typeof createSourceRetrievalPolicy !== 'function' ||
    typeof createSourceBudget !== 'function'
  ) {
    return undefined
  }
  const policy = createSourceRetrievalPolicy(overrides)
  return { policy, budget: createSourceBudget(policy) }
}

describe('Node source acquirer', () => {
  test('loads files inside an allowed real path and blocks symlink escapes', async () => {
    const nodeModule = await loadNodeModule()
    const createNodeSourceAcquirer = nodeModule.createNodeSourceAcquirer
    expect(createNodeSourceAcquirer).toEqual(expect.any(Function))
    if (typeof createNodeSourceAcquirer !== 'function') return

    const workspace = await mkdtemp(path.join(tmpdir(), 'schema-flow-source-'))
    temporaryDirectories.push(workspace)
    const root = path.join(workspace, 'root')
    const outside = path.join(workspace, 'outside.yaml')
    const inside = path.join(root, 'openapi.yaml')
    const escapedLink = path.join(root, 'escaped.yaml')
    await writeFile(outside, 'openapi: 3.1.0\n', 'utf8')
    await writeFile(inside, 'openapi: 3.1.0\n', { encoding: 'utf8', flag: 'w' }).catch(async () => {
      const { mkdir } = await import('node:fs/promises')
      await mkdir(root, { recursive: true })
      await writeFile(inside, 'openapi: 3.1.0\n', 'utf8')
    })
    await symlink(outside, escapedLink)

    const context = policyAndBudget({ allowedFileRoots: [root] })
    expect(context).toBeDefined()
    if (!context) return

    const acquirer = createNodeSourceAcquirer() as {
      acquire(
        location: unknown,
        context: unknown,
      ): Promise<{
        source?: { uri: string; contents: string }
        diagnostics: readonly { code: string }[]
      }>
    }
    const loaded = await acquirer.acquire({ kind: 'file', path: inside }, context)
    expect(loaded.diagnostics).toEqual([])
    expect(loaded.source).toMatchObject({
      uri: pathToFileURL(inside).href,
      contents: 'openapi: 3.1.0\n',
    })

    const blockedContext = policyAndBudget({ allowedFileRoots: [root] })
    if (!blockedContext) return
    const blocked = await acquirer.acquire({ kind: 'file', path: escapedLink }, blockedContext)
    expect(blocked.source).toBeUndefined()
    expect(blocked.diagnostics).toEqual([expect.objectContaining({ code: 'ASF-SRC-1004' })])
  })

  test('blocks private DNS results before fetch', async () => {
    const nodeModule = await loadNodeModule()
    const createNodeSourceAcquirer = nodeModule.createNodeSourceAcquirer
    expect(createNodeSourceAcquirer).toEqual(expect.any(Function))
    if (typeof createNodeSourceAcquirer !== 'function') return

    let fetchCalls = 0
    const acquirer = createNodeSourceAcquirer({
      resolveHostname: async () => ['127.0.0.1'],
      fetch: async () => {
        fetchCalls += 1
        return new Response('openapi: 3.1.0\n')
      },
    }) as {
      acquire(
        location: unknown,
        context: unknown,
      ): Promise<{
        source?: unknown
        diagnostics: readonly { code: string }[]
      }>
    }
    const context = policyAndBudget({})
    if (!context) return
    const result = await acquirer.acquire(
      { kind: 'url', url: 'https://example.test/openapi.yaml' },
      context,
    )

    expect(fetchCalls).toBe(0)
    expect(result.source).toBeUndefined()
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'ASF-SRC-1005' })])
  })

  test('loads an HTTPS document from a public address with credentials omitted', async () => {
    const nodeModule = await loadNodeModule()
    const createNodeSourceAcquirer = nodeModule.createNodeSourceAcquirer
    expect(createNodeSourceAcquirer).toEqual(expect.any(Function))
    if (typeof createNodeSourceAcquirer !== 'function') return

    const requests: { input: string; init?: Record<string, unknown> }[] = []
    const acquirer = createNodeSourceAcquirer({
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async (input: string, init?: Record<string, unknown>) => {
        requests.push({ input, init })
        return new Response('openapi: 3.1.0\n', {
          status: 200,
          headers: { 'content-type': 'application/yaml' },
        })
      },
    }) as {
      acquire(
        location: unknown,
        context: unknown,
      ): Promise<{
        source?: { uri: string; mediaType?: string; contents: string }
        diagnostics: readonly { code: string }[]
      }>
    }
    const context = policyAndBudget({})
    if (!context) return
    const result = await acquirer.acquire(
      { kind: 'url', url: 'https://example.test/openapi.yaml' },
      context,
    )

    expect(result.diagnostics).toEqual([])
    expect(result.source).toMatchObject({
      uri: 'https://example.test/openapi.yaml',
      mediaType: 'application/yaml',
      contents: 'openapi: 3.1.0\n',
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.init).toMatchObject({ redirect: 'manual', credentials: 'omit' })
  })
})
