import { readFile } from 'node:fs/promises'

import {
  isReviewWorkspaceSnapshot,
  type ReviewDecision,
  type ReviewWorkspaceSnapshot,
} from '@api-schema-flow/domain'
import { canonicalizeJson } from '@api-schema-flow/flow'
import { describe, expect, test } from 'vitest'

const fixtureUrl = new URL(
  '../../../../apps/web/public/fixtures/reservation-workspace.json',
  import.meta.url,
)

async function loadSnapshot(): Promise<ReviewWorkspaceSnapshot> {
  const value = JSON.parse(await readFile(fixtureUrl, 'utf8')) as unknown
  expect(isReviewWorkspaceSnapshot(value)).toBe(true)
  if (!isReviewWorkspaceSnapshot(value)) {
    throw new Error('Reservation fixture is not a Review Workspace Snapshot 1.1.')
  }
  return value
}

function semanticDecision(
  snapshot: ReviewWorkspaceSnapshot,
): Omit<ReviewDecision, 'id' | 'decidedAt'> {
  const candidate = snapshot.inferenceCandidates.find(({ blockers }) => blockers.length === 0)
  if (candidate === undefined) throw new Error('Expected an unblocked Reservation candidate.')

  return {
    schemaVersion: '1.0',
    candidateId: candidate.id,
    candidateFingerprint: candidate.fingerprint,
    ruleSetVersion: candidate.ruleSetVersion,
    revision: snapshot.reviewDecisionSet.revision + 10,
    action: 'accept',
  }
}

describe('browser and package-root Review parity', () => {
  test('creates the same deterministic decision identity', async () => {
    const snapshot = await loadSnapshot()
    const [root, browser] = await Promise.all([
      import('@api-schema-flow/review'),
      import('@api-schema-flow/review/browser'),
    ])
    const semantic = semanticDecision(snapshot)

    expect(browser.createReviewDecisionId(semantic)).toBe(root.createReviewDecisionId(semantic))
  })

  test('keeps canonicalization, resolution, and materialization byte-equivalent', async () => {
    const snapshot = await loadSnapshot()
    const [root, browser] = await Promise.all([
      import('@api-schema-flow/review'),
      import('@api-schema-flow/review/browser'),
    ])
    const semantic = semanticDecision(snapshot)
    const rootDecision = { ...semantic, id: root.createReviewDecisionId(semantic) }
    const browserDecision = { ...semantic, id: browser.createReviewDecisionId(semantic) }
    const base = {
      schemaVersion: '1.0' as const,
      revision: semantic.revision,
      manualEdges: snapshot.reviewDecisionSet.manualEdges,
    }
    const rootDecisionSet = root.canonicalizeDecisionSet({
      ...base,
      decisions: [...snapshot.reviewDecisionSet.decisions, rootDecision],
    })
    const browserDecisionSet = browser.canonicalizeDecisionSet({
      ...base,
      decisions: [...snapshot.reviewDecisionSet.decisions, browserDecision],
    })

    expect(canonicalizeJson(browserDecisionSet)).toBe(canonicalizeJson(rootDecisionSet))

    const rootResolution = root.resolveReviewDecisions({
      candidates: snapshot.inferenceCandidates,
      decisionSet: rootDecisionSet,
    })
    const browserResolution = browser.resolveReviewDecisions({
      candidates: snapshot.inferenceCandidates,
      decisionSet: browserDecisionSet,
    })
    expect(canonicalizeJson(browserResolution)).toBe(canonicalizeJson(rootResolution))

    const rootMaterialization = root.materializeReviewedOperationGraph({
      declaredOperationGraph: snapshot.declaredGraph,
      candidates: snapshot.inferenceCandidates,
      decisionSet: rootDecisionSet,
    })
    const browserMaterialization = browser.materializeReviewedOperationGraph({
      declaredOperationGraph: snapshot.declaredGraph,
      candidates: snapshot.inferenceCandidates,
      decisionSet: browserDecisionSet,
    })

    expect(canonicalizeJson(browserMaterialization.graph)).toBe(
      canonicalizeJson(rootMaterialization.graph),
    )
    expect(canonicalizeJson(browserMaterialization.outcomes)).toBe(
      canonicalizeJson(rootMaterialization.outcomes),
    )
    expect(canonicalizeJson(browserMaterialization.metrics)).toBe(
      canonicalizeJson(rootMaterialization.metrics),
    )
    expect(canonicalizeJson(browserMaterialization.diagnostics)).toBe(
      canonicalizeJson(rootMaterialization.diagnostics),
    )
  })
})
