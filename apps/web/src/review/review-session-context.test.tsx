import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { loadWorkspaceSnapshot } from '../data/load-workspace'
import type { WorkspaceSnapshot } from '../data/types'
import { deriveBaselineRevisions } from './decision-factory'
import type { ReviewSessionMaterialization } from './review-engine'
import { ReviewSessionProvider, useReviewSession } from './review-session-context'

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

function ContextProbe({
  candidateId,
  onMaterialization,
}: {
  readonly candidateId: string
  readonly onMaterialization: (value: ReviewSessionMaterialization) => void
}) {
  const review = useReviewSession()
  const latestDecision = review.materialization.draftDecisions.at(-1)

  useEffect(() => {
    onMaterialization(review.materialization)
  }, [onMaterialization, review.materialization])

  return (
    <div>
      <output data-testid="project-fingerprint">{review.state.projectFingerprint}</output>
      <output data-testid="source-revision">{review.state.sourceRevision}</output>
      <output data-testid="baseline-revisions">
        {JSON.stringify(review.state.baselineRevisions)}
      </output>
      <output data-testid="projected-row-count">{review.projection.rows.length}</output>
      <output data-testid="draft-count">{review.state.draftIntents.length}</output>
      <output data-testid="selected-candidate">{review.state.selectedCandidateId ?? 'none'}</output>
      <output data-testid="review-query">{review.state.filters.query || 'empty'}</output>
      <output data-testid="decision-count">
        {review.materialization.decisionSet.decisions.length}
      </output>
      <output data-testid="latest-action">{latestDecision?.action ?? 'none'}</output>
      <output data-testid="latest-revision">{latestDecision?.revision ?? 0}</output>
      <button type="button" onClick={() => review.selectCandidate(candidateId)}>
        Probe Select
      </button>
      <button type="button" onClick={() => review.dispatch({ type: 'set-query', query: 'token' })}>
        Probe Query
      </button>
      <button type="button" onClick={() => review.acceptCandidate(candidateId)}>
        Probe Accept
      </button>
      <button type="button" onClick={() => review.rejectCandidate(candidateId, 'wrong-field')}>
        Probe Reject
      </button>
      <button type="button" onClick={review.undoLastDraft}>
        Probe Undo
      </button>
    </div>
  )
}

describe('ReviewSessionProvider', () => {
  test('initializes from deterministic snapshot review identity and baseline revisions', async () => {
    const snapshot = await canonicalSnapshot()
    const candidateId = snapshot.inferenceCandidates[0]!.id
    const onMaterialization = vi.fn()

    render(
      <ReviewSessionProvider snapshot={snapshot}>
        <ContextProbe candidateId={candidateId} onMaterialization={onMaterialization} />
      </ReviewSessionProvider>,
    )

    expect(screen.getByTestId('project-fingerprint')).toHaveTextContent(
      snapshot.reviewContext.projectFingerprint,
    )
    expect(screen.getByTestId('source-revision')).toHaveTextContent(
      snapshot.reviewContext.sourceRevision,
    )
    expect(JSON.parse(screen.getByTestId('baseline-revisions').textContent ?? '{}')).toEqual(
      deriveBaselineRevisions(snapshot.reviewDecisionSet),
    )
    expect(screen.getByTestId('projected-row-count')).toHaveTextContent(
      String(snapshot.inferenceCandidates.length),
    )
    expect(screen.getByTestId('draft-count')).toHaveTextContent('0')
    await waitFor(() => expect(onMaterialization).toHaveBeenCalledOnce())
  })

  test('does not rematerialize the graph for presentation-only selection and filter changes', async () => {
    const user = userEvent.setup()
    const snapshot = await canonicalSnapshot()
    const candidateId = snapshot.inferenceCandidates[0]!.id
    const onMaterialization = vi.fn()

    render(
      <ReviewSessionProvider snapshot={snapshot}>
        <ContextProbe candidateId={candidateId} onMaterialization={onMaterialization} />
      </ReviewSessionProvider>,
    )
    await waitFor(() => expect(onMaterialization).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Probe Select' }))
    expect(screen.getByTestId('selected-candidate')).toHaveTextContent(candidateId)
    expect(onMaterialization).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Probe Query' }))
    expect(screen.getByTestId('review-query')).toHaveTextContent('token')
    expect(onMaterialization).toHaveBeenCalledTimes(1)
  })

  test('recomputes one immutable materialization for Accept, Reject, and Undo', async () => {
    const user = userEvent.setup()
    const snapshot = await canonicalSnapshot()
    const candidate = snapshot.inferenceCandidates.find(
      ({ id }) => !Object.hasOwn(deriveBaselineRevisions(snapshot.reviewDecisionSet), id),
    )!
    const materializations: ReviewSessionMaterialization[] = []
    const onMaterialization = vi.fn((value: ReviewSessionMaterialization) => {
      materializations.push(value)
    })
    const declaredEdges = snapshot.declaredGraph.edges
    const baselineDecisions = snapshot.reviewDecisionSet.decisions
    const candidates = snapshot.inferenceCandidates

    render(
      <ReviewSessionProvider snapshot={snapshot}>
        <ContextProbe candidateId={candidate.id} onMaterialization={onMaterialization} />
      </ReviewSessionProvider>,
    )
    await waitFor(() => expect(onMaterialization).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Probe Accept' }))
    await waitFor(() => expect(screen.getByTestId('draft-count')).toHaveTextContent('1'))
    expect(onMaterialization).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('latest-action')).toHaveTextContent('accept')
    expect(screen.getByTestId('latest-revision')).toHaveTextContent('1')
    const accepted = materializations.at(-1)!

    await user.click(screen.getByRole('button', { name: 'Probe Reject' }))
    await waitFor(() => expect(screen.getByTestId('draft-count')).toHaveTextContent('2'))
    expect(onMaterialization).toHaveBeenCalledTimes(3)
    expect(screen.getByTestId('latest-action')).toHaveTextContent('reject')
    expect(screen.getByTestId('latest-revision')).toHaveTextContent('2')
    expect(materializations.at(-1)).not.toBe(accepted)

    await user.click(screen.getByRole('button', { name: 'Probe Undo' }))
    await waitFor(() => expect(screen.getByTestId('draft-count')).toHaveTextContent('1'))
    expect(onMaterialization).toHaveBeenCalledTimes(4)
    expect(materializations.at(-1)).not.toBe(accepted)
    expect(materializations.at(-1)).toEqual(accepted)

    expect(snapshot.declaredGraph.edges).toBe(declaredEdges)
    expect(snapshot.reviewDecisionSet.decisions).toBe(baselineDecisions)
    expect(snapshot.inferenceCandidates).toBe(candidates)
  })
})
