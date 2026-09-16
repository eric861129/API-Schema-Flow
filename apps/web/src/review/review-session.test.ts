import { describe, expect, test } from 'vitest'

import { deriveBaselineRevisions } from './decision-factory'
import {
  createInitialReviewSession,
  getNextReviewRevision,
  reviewSessionReducer,
  validateRejectReason,
} from './review-session'

describe('review session', () => {
  test('starts with pending high and medium candidates in mapping mode', () => {
    const state = createInitialReviewSession({
      projectFingerprint: 'project:reservation',
      sourceRevision: 'revision:1',
    })

    expect(state).toMatchObject({
      schemaVersion: '1.0',
      selectedCandidateId: null,
      draftIntents: [],
      sort: 'confidence-desc',
      evidenceOpen: true,
      previewMode: 'mapping',
      filters: {
        query: '',
        confidenceBands: ['high', 'medium'],
        reviewState: 'pending',
        hasBlockersOnly: false,
      },
    })
  })

  test('allocates the next immutable revision from baseline and draft actions', () => {
    let state = createInitialReviewSession({
      projectFingerprint: 'project:reservation',
      sourceRevision: 'revision:1',
      baselineRevisions: { 'candidate:one': 3 },
    })

    expect(getNextReviewRevision(state, 'candidate:one')).toBe(4)

    state = reviewSessionReducer(state, {
      type: 'accept-candidate',
      candidateId: 'candidate:one',
    })
    state = reviewSessionReducer(state, {
      type: 'reject-candidate',
      candidateId: 'candidate:one',
      reason: 'wrong-field',
    })

    expect(state.draftIntents).toEqual([
      {
        action: 'accept',
        candidateId: 'candidate:one',
        revision: 4,
      },
      {
        action: 'reject',
        candidateId: 'candidate:one',
        revision: 5,
        reason: 'wrong-field',
      },
    ])
  })

  test('uses maximum derived baseline revisions when allocating the next intent', () => {
    const baselineRevisions = deriveBaselineRevisions({
      schemaVersion: '1.0',
      revision: 3,
      decisions: [
        {
          schemaVersion: '1.0',
          id: 'decision:v1',
          candidateId: 'candidate:one',
          candidateFingerprint: 'fingerprint:one',
          ruleSetVersion: '1.0.0',
          revision: 1,
          action: 'reject',
        },
        {
          schemaVersion: '1.0',
          id: 'decision:v3',
          candidateId: 'candidate:one',
          candidateFingerprint: 'fingerprint:one',
          ruleSetVersion: '1.0.0',
          revision: 3,
          action: 'accept',
        },
      ],
      manualEdges: [],
    })
    const state = createInitialReviewSession({
      projectFingerprint: 'project:reservation',
      sourceRevision: 'revision:1',
      baselineRevisions,
    })

    expect(getNextReviewRevision(state, 'candidate:one')).toBe(4)
  })

  test('requires a note only for the Other reject reason', () => {
    expect(validateRejectReason('wrong-resource')).toEqual({ valid: true })
    expect(validateRejectReason('other', 'Needs domain review')).toEqual({ valid: true })
    expect(validateRejectReason('other', '   ')).toEqual({
      valid: false,
      message: 'A note is required when the reject reason is Other.',
    })
  })

  test('does not mutate state for an invalid rejection', () => {
    const state = createInitialReviewSession({
      projectFingerprint: 'project:reservation',
      sourceRevision: 'revision:1',
    })

    expect(
      reviewSessionReducer(state, {
        type: 'reject-candidate',
        candidateId: 'candidate:one',
        reason: 'other',
      }),
    ).toBe(state)
  })

  test('undo removes only the latest draft intent', () => {
    let state = createInitialReviewSession({
      projectFingerprint: 'project:reservation',
      sourceRevision: 'revision:1',
    })
    state = reviewSessionReducer(state, {
      type: 'accept-candidate',
      candidateId: 'candidate:one',
    })
    state = reviewSessionReducer(state, {
      type: 'reject-candidate',
      candidateId: 'candidate:two',
      reason: 'duplicate',
    })

    const undone = reviewSessionReducer(state, { type: 'undo-last-draft' })

    expect(undone.draftIntents).toEqual([state.draftIntents[0]])
    expect(state.draftIntents).toHaveLength(2)
  })

  test('updates filters and preview controls without changing semantic inputs', () => {
    const initial = createInitialReviewSession({
      projectFingerprint: 'project:reservation',
      sourceRevision: 'revision:1',
    })
    const selected = reviewSessionReducer(initial, {
      type: 'select-candidate',
      candidateId: 'candidate:one',
    })
    const queried = reviewSessionReducer(selected, {
      type: 'set-query',
      query: 'reservation',
    })
    const topology = reviewSessionReducer(queried, {
      type: 'set-preview-mode',
      mode: 'topology',
    })

    expect(topology.selectedCandidateId).toBe('candidate:one')
    expect(topology.filters.query).toBe('reservation')
    expect(topology.previewMode).toBe('topology')
    expect(initial.filters.query).toBe('')
  })
})
