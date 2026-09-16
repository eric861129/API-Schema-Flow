import { describe, expect, test } from 'vitest'

import { createReviewWorkspaceFixture } from '../test/review-workspace-fixture'
import { loadWorkspaceSnapshot, type WorkspaceLoadError } from './load-workspace'

function jsonResponse(value: unknown, status = 200): typeof fetch {
  return async () =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    })
}

async function expectLoadError(
  promise: Promise<unknown>,
  code: WorkspaceLoadError['code'],
  message: string,
) {
  await expect(promise).rejects.toMatchObject({ code, message })
}

describe('loadWorkspaceSnapshot', () => {
  test('returns a typed Review Workspace Snapshot 1.1 after validation', async () => {
    const snapshot = await loadWorkspaceSnapshot(
      '/fixture.json',
      jsonResponse(createReviewWorkspaceFixture()),
    )

    expect(snapshot.schemaVersion).toBe('1.1')
    expect(snapshot.reviewContext.projectFingerprint).toBe('project:reservation:v1')
    expect(snapshot.inferenceCandidates[0]?.mapping).toBeUndefined()
    expect(snapshot.reviewDecisionSet.decisions).toEqual([])
    expect(snapshot.reviewOutcomes[0]?.state).toBeUndefined()
    expect(snapshot.declaredGraph.edges).toEqual([])
  })

  test('maps a fetch exception to a network error', async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error('offline')
    }

    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', fetcher),
      'network',
      'The Reservation workspace could not be loaded. Check the local server and retry.',
    )
  })

  test('maps a non-OK response to a network error', async () => {
    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', jsonResponse({}, 503)),
      'network',
      'The Reservation workspace returned HTTP 503.',
    )
  })

  test('maps malformed JSON to invalid-json', async () => {
    const fetcher: typeof fetch = async () =>
      new Response('{', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', fetcher),
      'invalid-json',
      'The workspace fixture is not valid JSON.',
    )
  })

  test('rejects Snapshot 1.0 with a concrete 1.1 requirement', async () => {
    const value = { ...createReviewWorkspaceFixture(), schemaVersion: '1.0' }

    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', jsonResponse(value)),
      'unsupported',
      'This build requires review workspace snapshot 1.1, but received 1.0.',
    )
  })

  test('rejects unknown future snapshot versions', async () => {
    const value = { ...createReviewWorkspaceFixture(), schemaVersion: '9.0' }

    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', jsonResponse(value)),
      'unsupported',
      'This build requires review workspace snapshot 1.1, but received 9.0.',
    )
  })

  test('rejects a 1.1 snapshot without a review decision set as invalid-shape', async () => {
    const value: Record<string, unknown> = { ...createReviewWorkspaceFixture() }
    delete value.reviewDecisionSet

    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', jsonResponse(value)),
      'invalid-shape',
      'The review workspace fixture does not match the Snapshot 1.1 contract.',
    )
  })

  test('rejects a 1.1 snapshot with an invalid declared graph as invalid-shape', async () => {
    const snapshot = createReviewWorkspaceFixture()
    const value = {
      ...snapshot,
      declaredGraph: { ...snapshot.declaredGraph, kind: 'workflow-instance' },
    }

    await expectLoadError(
      loadWorkspaceSnapshot('/fixture.json', jsonResponse(value)),
      'invalid-shape',
      'The review workspace fixture does not match the Snapshot 1.1 contract.',
    )
  })
})
