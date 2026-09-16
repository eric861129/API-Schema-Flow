import { describe, expect, test } from 'vitest'
import { createReviewDecisionId } from '@api-schema-flow/review/browser'
import raw from '../../public/fixtures/reservation-workspace.json'
import type { WorkspaceSnapshot } from '../data/types'
import { materializeReviewSession } from './review-engine'
import { reviewSessionReducer } from './review-session'
import {
  decodeStoredReview,
  encodeStoredReview,
  initialStoredSession,
  mergeDecisionSets,
  parseDecisionFile,
  previewDecisionImport,
  serializeDecisionSet,
} from './review-transfer'

const snapshot = raw as unknown as WorkspaceSnapshot
const candidate = snapshot.inferenceCandidates.find((item) => item.blockers.length === 0)!
const initial = () => initialStoredSession(snapshot)

describe('review persistence and transfer', () => {
  test('reimporting current export preserves Undo of local decisions', () => {
    const accepted = reviewSessionReducer(initial(), {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    const exported = materializeReviewSession(snapshot, accepted).decisionSet
    const imported = previewDecisionImport(
      snapshot,
      accepted,
      parseDecisionFile(serializeDecisionSet(exported)),
    ).state
    const undone = reviewSessionReducer(imported, { type: 'undo-last-draft' })
    expect(materializeReviewSession(snapshot, undone).decisionSet.decisions).toEqual(
      materializeReviewSession(snapshot, initial()).decisionSet.decisions,
    )
  })
  test('restores accepted/rejected history and Undo without changing the baseline', () => {
    const before = JSON.stringify(snapshot)
    const accepted = reviewSessionReducer(initial(), {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    const rejected = reviewSessionReducer(accepted, {
      type: 'reject-candidate',
      candidateId: candidate.id,
      reason: 'other',
      note: '人工確認來源不符',
    })
    const restored = decodeStoredReview(
      snapshot,
      JSON.parse(JSON.stringify(encodeStoredReview(snapshot, rejected))),
    )
    expect(restored.draftIntents).toEqual(rejected.draftIntents)
    expect(
      materializeReviewSession(
        snapshot,
        reviewSessionReducer(restored, { type: 'undo-last-draft' }),
      ).decisionSet,
    ).toEqual(materializeReviewSession(snapshot, accepted).decisionSet)
    expect(JSON.stringify(snapshot)).toBe(before)
  })
  test('exports deterministic core-compatible JSON and imports idempotently', () => {
    const state = reviewSessionReducer(initial(), {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    const set = materializeReviewSession(snapshot, state).decisionSet
    const encoded = serializeDecisionSet(set)
    expect(serializeDecisionSet(parseDecisionFile(encoded))).toBe(encoded)
    const imported = previewDecisionImport(snapshot, initial(), parseDecisionFile(encoded)).state
    const again = previewDecisionImport(snapshot, imported, parseDecisionFile(encoded)).state
    expect(serializeDecisionSet(materializeReviewSession(snapshot, again).decisionSet)).toBe(
      encoded,
    )
    const next = reviewSessionReducer(again, {
      type: 'reject-candidate',
      candidateId: candidate.id,
      reason: 'wrong-field',
    })
    expect(next.draftIntents.at(-1)!.revision).toBeGreaterThan(state.draftIntents[0]!.revision)
  })
  test('rejects invalid files, unknown versions and changed baselines without mutating session', () => {
    const state = initial()
    const encoded = encodeStoredReview(snapshot, state)
    expect(encoded).toMatchObject({ schemaVersion: '1.0', toolVersion: expect.any(String) })
    expect(() => decodeStoredReview(snapshot, { ...encoded, schemaVersion: '999' })).toThrow(
      /preserved/,
    )
    expect(() => decodeStoredReview(snapshot, { ...encoded, toolVersion: '' })).toThrow(/preserved/)
    expect(() => parseDecisionFile('{')).toThrow()
    expect(() => parseDecisionFile('{"schemaVersion":"99"}')).toThrow()
    expect(() =>
      parseDecisionFile(
        JSON.stringify({
          schemaVersion: '1.0',
          revision: Number.MAX_SAFE_INTEGER,
          decisions: [],
          manualEdges: [],
        }),
      ),
    ).toThrow(/safe integer/)
    expect(() => decodeStoredReview(snapshot, { version: 99 })).toThrow(/preserved/)
    expect(() =>
      decodeStoredReview(snapshot, { ...encodeStoredReview(snapshot, state), baseline: 'changed' }),
    ).toThrow(/preserved/)
    expect(() =>
      decodeStoredReview(snapshot, {
        ...encodeStoredReview(snapshot, state),
        draftIntents: [null],
      }),
    ).toThrow()
    expect(state).toEqual(initial())
  })
  test('preserves stale decision identities and previews conflicts instead of silently rebasing them', () => {
    const state = reviewSessionReducer(initial(), {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    const accepted = materializeReviewSession(snapshot, state).draftDecisions[0]!
    const stale = { ...accepted, candidateFingerprint: 'previous-source-fingerprint' }
    const staleDecision = { ...stale, id: createReviewDecisionId(stale) }
    const incoming = {
      schemaVersion: '1.0' as const,
      revision: stale.revision,
      decisions: [staleDecision],
      manualEdges: [],
    }
    const preview = previewDecisionImport(snapshot, initial(), incoming)
    expect(preview.materialization.result.outcomes.some((item) => item.state === 'stale')).toBe(
      true,
    )
    expect(preview.state.importedDecisionSet?.decisions[0]?.candidateFingerprint).toBe(
      'previous-source-fingerprint',
    )
    const rejected = { ...accepted, action: 'reject' as const }
    const conflicting = mergeDecisionSets(incoming, {
      ...incoming,
      decisions: [accepted, { ...rejected, id: createReviewDecisionId(rejected) }],
    })
    expect(
      previewDecisionImport(
        snapshot,
        initial(),
        conflicting,
      ).materialization.result.diagnostics.some((item) => /conflict/i.test(item.message)),
    ).toBe(true)
  })
})
