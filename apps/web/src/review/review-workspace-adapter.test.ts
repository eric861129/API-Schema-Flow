import { describe, expect, test } from 'vitest'

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { REVIEW_DECISION_SCHEMA_VERSION, type ReviewDecisionOutcome } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import { loadWorkspaceSnapshot } from '../data/load-workspace'
import type { WorkspaceSnapshot } from '../data/types'
import { deriveBaselineRevisions } from './decision-factory'
import { materializeReviewSession, type ReviewSessionMaterialization } from './review-engine'
import { projectReviewWorkspace, resolveReviewCandidateState } from './review-workspace-adapter'
import { createInitialReviewSession } from './review-session'

async function canonicalSnapshot(): Promise<WorkspaceSnapshot> {
  return loadWorkspaceSnapshot(
    '/fixture.json',
    async () =>
      new Response(JSON.stringify(rawSnapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
}

function baselineMaterialization(snapshot: WorkspaceSnapshot): ReviewSessionMaterialization {
  return materializeReviewSession(
    snapshot,
    createInitialReviewSession({
      projectFingerprint: snapshot.reviewContext.projectFingerprint,
      sourceRevision: snapshot.reviewContext.sourceRevision,
      baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
    }),
  )
}

function outcome(
  state: ReviewDecisionOutcome['state'],
  candidateId = 'candidate:state',
  decisionId = `decision:${state}`,
): ReviewDecisionOutcome {
  return { decisionId, candidateId, state }
}

const stateDecisionSet = {
  schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
  revision: 3,
  decisions: [
    {
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      id: 'decision:accept',
      candidateId: 'candidate:state',
      candidateFingerprint: 'fingerprint:state',
      ruleSetVersion: '1.0.0',
      revision: 3,
      action: 'accept' as const,
    },
    {
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      id: 'decision:edit',
      candidateId: 'candidate:state',
      candidateFingerprint: 'fingerprint:state',
      ruleSetVersion: '1.0.0',
      revision: 3,
      action: 'edit' as const,
      editedMapping: {
        id: 'mapping:edited',
        source: { kind: 'response-body' as const, pointer: '#/id' },
        target: { kind: 'path-parameter' as const, name: 'id' },
        aliases: [],
        sourcePointers: [],
      },
    },
    {
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      id: 'decision:reject',
      candidateId: 'candidate:state',
      candidateFingerprint: 'fingerprint:state',
      ruleSetVersion: '1.0.0',
      revision: 3,
      action: 'reject' as const,
    },
  ],
  manualEdges: [],
}

describe('review workspace Domain adapter', () => {
  test('projects Domain candidates into the existing row and detail view models', async () => {
    const snapshot = await canonicalSnapshot()
    const projection = projectReviewWorkspace(snapshot, baselineMaterialization(snapshot))
    const token = [...projection.details.values()].find(
      ({ sourceOperationKey }) => sourceOperationKey === 'operation:post:/auth/login',
    )
    const space = [...projection.details.values()].find(
      ({ sourceOperationKey, targetOperationKey }) =>
        sourceOperationKey === 'operation:get:/spaces/available' &&
        targetOperationKey === 'operation:post:/reservations',
    )

    expect(projection.rows).toHaveLength(snapshot.inferenceCandidates.length)
    expect(projection.baselineRevisions).toEqual(
      deriveBaselineRevisions(snapshot.reviewDecisionSet),
    )
    expect(token).toMatchObject({
      sourceLabel: 'POST /auth/login',
      sourceSelector: '$response.body#/token',
      targetLabel: 'GET /spaces/available',
      targetDescriptor: 'header.Authorization',
      confidence: 0.96,
      band: 'high',
      evidenceCount: 2,
      blockerCount: 0,
      state: 'accepted',
      ruleSetVersion: 'm2c-v1',
      sourceSchema: { type: 'string', arrayDepth: 0 },
      targetSchema: { type: 'string', required: true, arrayDepth: 0 },
      transform: 'Bearer {$steps.source.outputs.token}',
      outcomeState: 'applied',
    })
    expect(token?.sourcePointers).toContain(
      'fixture://reservation/openapi.yaml#/components/schemas/LoginResponse/properties/token',
    )
    expect(token?.evidence[0]).toMatchObject({ kind: 'positive' })

    expect(space).toMatchObject({
      sourceSelector: '$response.body#/id',
      targetDescriptor: 'requestBody#/spaceId',
      sourceSchema: { type: 'string', format: 'uuid', arrayDepth: 1 },
      targetSchema: { type: 'string', format: 'uuid', required: true, arrayDepth: 0 },
      blockerCount: 1,
      state: 'edited',
    })
    expect(space?.blockers[0]).toMatchObject({ code: 'INF-BLOCK-ARRAY-SELECTOR' })
  })

  test('projects aliases and template transforms deterministically', async () => {
    const snapshot = await canonicalSnapshot()
    const original = snapshot.inferenceCandidates[0]!
    const aliased = {
      ...original,
      mapping: {
        ...original.mapping,
        aliases: [
          {
            kind: 'step-output' as const,
            workflowId: 'reservation',
            stepId: 'listSpaces',
            outputName: 'spaceId',
          },
          {
            kind: 'step-output' as const,
            workflowId: 'reservation',
            stepId: 'login',
            outputName: 'token',
          },
        ],
        transform: { kind: 'template' as const, raw: 'Value {$steps.source.outputs.id}' },
      },
    }
    const custom: WorkspaceSnapshot = {
      ...snapshot,
      inferenceCandidates: [aliased],
      reviewDecisionSet: {
        schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
        revision: 0,
        decisions: [],
        manualEdges: [],
      },
      acceptedGraph: snapshot.declaredGraph,
      reviewOutcomes: [],
    }
    const detail = projectReviewWorkspace(custom, baselineMaterialization(custom)).details.get(
      aliased.id,
    )

    expect(detail?.alias).toBe('reservation.listSpaces.spaceId, reservation.login.token')
    expect(detail?.transform).toBe('Value {$steps.source.outputs.id}')
  })

  test('marks incompatible response schema matches as unknown instead of choosing by order', async () => {
    const snapshot = await canonicalSnapshot()
    const sourceOperation = snapshot.apiDocument.operations.find(
      ({ id }) => id === 'operation:post:/auth/login',
    )!
    const baseSchema = sourceOperation.responses[0]!.content[0]!.schema!
    const stringToken = baseSchema.properties.token!
    const integerToken = { ...stringToken, types: ['integer'] }
    const ambiguousOperation = {
      ...sourceOperation,
      responses: [
        ...sourceOperation.responses,
        {
          ...sourceOperation.responses[0]!,
          statusCode: '202',
          content: [
            {
              ...sourceOperation.responses[0]!.content[0]!,
              schema: {
                ...baseSchema,
                properties: { ...baseSchema.properties, token: integerToken },
              },
            },
          ],
        },
      ],
    }
    const custom: WorkspaceSnapshot = {
      ...snapshot,
      apiDocument: {
        ...snapshot.apiDocument,
        operations: snapshot.apiDocument.operations.map((operation) =>
          operation.id === ambiguousOperation.id ? ambiguousOperation : operation,
        ),
      },
    }
    const detail = projectReviewWorkspace(custom, baselineMaterialization(custom)).details.get(
      snapshot.inferenceCandidates.find(
        ({ sourceOperationKey }) => sourceOperationKey === sourceOperation.id,
      )!.id,
    )

    expect(detail?.sourceSchema.type).toBeUndefined()
    expect(detail?.schemaWarnings).toContain(
      'Source schema is ambiguous across successful response variants.',
    )
  })

  test('applies the documented candidate-state priority', () => {
    const conflict: Diagnostic = {
      code: DIAGNOSTIC_CODES.REVIEW_DECISION_CONFLICT,
      severity: 'error',
      message: 'Conflict',
      details: { candidateId: 'candidate:state' },
    }

    expect(
      resolveReviewCandidateState(
        'candidate:state',
        stateDecisionSet,
        [outcome('invalid')],
        [conflict],
      ).state,
    ).toBe('conflict')
    expect(
      resolveReviewCandidateState(
        'candidate:state',
        stateDecisionSet,
        [outcome('invalid'), outcome('stale')],
        [],
      ).state,
    ).toBe('invalid')
    expect(
      resolveReviewCandidateState(
        'candidate:state',
        stateDecisionSet,
        [outcome('stale'), outcome('orphaned')],
        [],
      ).state,
    ).toBe('stale')
    expect(
      resolveReviewCandidateState('candidate:state', stateDecisionSet, [outcome('orphaned')], [])
        .state,
    ).toBe('orphaned')
    expect(
      resolveReviewCandidateState(
        'candidate:state',
        { ...stateDecisionSet, decisions: [stateDecisionSet.decisions[0]!] },
        [outcome('applied', 'candidate:state', 'decision:accept')],
        [],
      ).state,
    ).toBe('accepted')
    expect(
      resolveReviewCandidateState(
        'candidate:state',
        { ...stateDecisionSet, decisions: [stateDecisionSet.decisions[0]!] },
        [outcome('already-present', 'candidate:state', 'decision:accept')],
        [],
      ),
    ).toMatchObject({ state: 'accepted', outcomeState: 'already-present' })
    expect(
      resolveReviewCandidateState(
        'candidate:state',
        { ...stateDecisionSet, decisions: [stateDecisionSet.decisions[1]!] },
        [outcome('applied', 'candidate:state', 'decision:edit')],
        [],
      ).state,
    ).toBe('edited')
    expect(
      resolveReviewCandidateState(
        'candidate:state',
        { ...stateDecisionSet, decisions: [stateDecisionSet.decisions[2]!] },
        [outcome('rejected', 'candidate:state', 'decision:reject')],
        [],
      ).state,
    ).toBe('rejected')
    expect(
      resolveReviewCandidateState('candidate:state', stateDecisionSet, [outcome('superseded')], [])
        .state,
    ).toBe('superseded')
    expect(resolveReviewCandidateState('candidate:state', stateDecisionSet, [], []).state).toBe(
      'pending',
    )
  })
})
