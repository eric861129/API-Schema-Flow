import { expect, test } from 'vitest'
import raw from '../../public/fixtures/reservation-workspace.json'
import type { WorkspaceSnapshot } from '../data/types'
import { reviewSessionReducer } from '../review/review-session'
import {
  decodeStoredReview,
  encodeStoredReview,
  initialStoredSession,
  serializeDecisionSet,
} from '../review/review-transfer'
import { materializeReviewSession } from '../review/review-engine'
import { parseProject, serializeProject } from './project-file'
import { DEFAULT_WORKSPACE_LAYOUT, parseWorkspaceLayout } from './workspace-layout'

const snapshot = raw as unknown as WorkspaceSnapshot
const nodeId = snapshot.declaredGraph.nodes[0]!.id
const candidateId = snapshot.inferenceCandidates[0]!.id
const initial = initialStoredSession(snapshot)
const layout = {
  ...DEFAULT_WORKSPACE_LAYOUT,
  direction: 'down' as const,
  topology: { positions: [{ id: nodeId, x: 42, y: -12 }], viewport: { x: 7, y: 8, zoom: 0.7 } },
}
const state = reviewSessionReducer(
  reviewSessionReducer(initial, { type: 'accept-candidate', candidateId }),
  { type: 'set-workspace-layout', layout },
)

test('round-trips decisions, Undo and independent layout with deterministic bytes', () => {
  const text = serializeProject(snapshot, state)
  const restored = parseProject(text, snapshot)
  expect(restored.draftIntents).toEqual(state.draftIntents)
  expect(restored.workspaceLayout).toEqual(layout)
  expect(serializeProject(snapshot, restored)).toBe(text)
  expect(
    materializeReviewSession(snapshot, reviewSessionReducer(restored, { type: 'undo-last-draft' }))
      .decisionSet,
  ).toEqual(materializeReviewSession(snapshot, initial).decisionSet)
  const payload = JSON.parse(text)
  expect(payload).toMatchObject({
    kind: 'api-schema-flow-project',
    schemaVersion: '1.0',
    toolVersion: expect.any(String),
  })
  expect(Object.keys(payload.source)).toEqual(['projectFingerprint', 'sourceRevision'])
  expect(payload.review.workspaceLayout).toBeUndefined()
  expect(text).not.toContain('apiDocument')
})

test('rejects source, format, metadata and layout corruption without modifying current state', () => {
  const text = serializeProject(snapshot, state)
  const mutate = (fn: (value: ReturnType<typeof JSON.parse>) => void) => {
    const value = JSON.parse(text)
    fn(value)
    return JSON.stringify(value)
  }
  for (const invalid of [
    '{',
    mutate((v) => {
      v.schemaVersion = '999'
    }),
    mutate((v) => {
      v.toolVersion = ''
    }),
    mutate((v) => {
      v.source.sourceRevision = 'other'
    }),
    mutate((v) => {
      v.source.projectFingerprint = 'other'
    }),
    mutate((v) => {
      v.layout.topology.positions[0].id = 'unknown'
    }),
    mutate((v) => {
      v.layout.topology.positions.push(v.layout.topology.positions[0])
    }),
    mutate((v) => {
      v.layout.topology.viewport.zoom = 0
    }),
    mutate((v) => {
      v.layout.topology.positions[0].x = null
    }),
    mutate((v) => {
      v.review.baseline = 'other'
    }),
    mutate((v) => {
      v.review.draftIntents = [null]
    }),
    mutate((v) => {
      v.layout.reactFlow = {}
    }),
    mutate((v) => {
      v.arbitrary = {}
    }),
  ])
    expect(() => parseProject(invalid, snapshot)).toThrow()
  expect(serializeProject(snapshot, state)).toBe(text)
  expect(() => parseProject(' '.repeat(5 * 1024 * 1024 + 1), snapshot)).toThrow(/5 MB/)
  expect(() =>
    parseWorkspaceLayout(
      { ...layout, topology: { positions: [{ id: nodeId, x: Infinity, y: 0 }] } },
      new Set([nodeId]),
    ),
  ).toThrow()
})

test('layout changes never change the Decision Set or Undo history', () => {
  const before = serializeDecisionSet(materializeReviewSession(snapshot, state).decisionSet)
  const changed = reviewSessionReducer(state, {
    type: 'set-workspace-layout',
    layout: DEFAULT_WORKSPACE_LAYOUT,
    reset: true,
  })
  expect(serializeDecisionSet(materializeReviewSession(snapshot, changed).decisionSet)).toBe(before)
  expect(changed.draftIntents).toBe(state.draftIntents)
  expect(changed.layoutRevision).toBe(1)
})

test('v1 local storage restores with a default layout without mutating its original record', () => {
  const record = encodeStoredReview(snapshot, state)
  const legacy = {
    version: 1,
    schemaVersion: '1.0',
    toolVersion: record.toolVersion,
    baseline: record.baseline,
    draftIntents: record.draftIntents,
  }
  const before = JSON.stringify(legacy)
  const restored = decodeStoredReview(snapshot, legacy)
  expect(restored.draftIntents).toEqual(state.draftIntents)
  expect(restored.workspaceLayout).toEqual(DEFAULT_WORKSPACE_LAYOUT)
  expect(JSON.stringify(legacy)).toBe(before)
  expect(encodeStoredReview(snapshot, restored)).toMatchObject({
    version: 2,
    schemaVersion: '2.0',
    workspaceLayout: DEFAULT_WORKSPACE_LAYOUT,
  })
})
