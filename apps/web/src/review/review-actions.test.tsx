import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { loadWorkspaceSnapshot } from '../data/load-workspace'
import type { WorkspaceSnapshot } from '../data/types'
import { materializeReviewSession } from './review-engine'
import { createInitialReviewSession } from './review-session'
import { ReviewSessionProvider } from './review-session-context'
import { ReviewWorkspace } from './review-workspace'
import { ReviewActions } from './review-actions'
import { projectReviewWorkspace } from './review-workspace-adapter'

async function createPendingSnapshot(): Promise<WorkspaceSnapshot> {
  const canonical = await loadWorkspaceSnapshot(
    '/fixture.json',
    async () => new Response(JSON.stringify(rawSnapshot)),
  )
  return {
    ...canonical,
    reviewDecisionSet: {
      ...canonical.reviewDecisionSet,
      revision: 0,
      decisions: [],
      manualEdges: [],
    },
    acceptedGraph: canonical.declaredGraph,
    reviewOutcomes: [],
  }
}

function renderWorkspace(snapshot: WorkspaceSnapshot) {
  render(
    <ReviewSessionProvider snapshot={snapshot}>
      <ReviewWorkspace />
    </ReviewSessionProvider>,
  )
}

async function renderPendingWorkspace() {
  const snapshot = await createPendingSnapshot()
  renderWorkspace(snapshot)
  return snapshot
}

async function createPendingCandidateDetail() {
  const snapshot = await createPendingSnapshot()
  const candidate = snapshot.inferenceCandidates.find(({ sourceOperationKey }) =>
    sourceOperationKey.includes('/auth/login'),
  )!
  const session = createInitialReviewSession({
    projectFingerprint: snapshot.reviewContext.projectFingerprint,
    sourceRevision: snapshot.reviewContext.sourceRevision,
  })
  const materialization = materializeReviewSession(snapshot, session)
  return projectReviewWorkspace(snapshot, materialization).details.get(candidate.id)!
}

describe('Review decision journey', () => {
  test('previews the unsaved graph by provenance and updates it after Undo', async () => {
    const user = userEvent.setup()
    await renderPendingWorkspace()
    await user.click(screen.getByRole('option', { name: /Source POST \/auth\/login/ }))
    await user.click(screen.getByRole('button', { name: /^Accept$/ }))
    await user.click(screen.getByRole('button', { name: 'Topology preview' }))
    const summary = screen.getByRole('region', { name: 'Draft graph summary' })
    expect(summary).toHaveTextContent('1 declared accepted')
    expect(summary).toHaveTextContent('1 inferred accepted')
    expect(summary).toHaveTextContent('0 manual accepted')
    expect(summary).toHaveTextContent('3 pending candidates outside the graph')
    expect(await screen.findByRole('region', { name: 'Review graph preview' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Undo latest change' }))
    expect(summary).toHaveTextContent('0 inferred accepted')
    expect(summary).toHaveTextContent('4 pending candidates outside the graph')
    await user.click(screen.getByRole('button', { name: 'Mapping preview' }))
    expect(screen.getByRole('region', { name: 'Review inferred data transfer' })).toBeVisible()
  })

  test('undo restores Accept, then baseline Pending and selection without modifying the snapshot', async () => {
    const user = userEvent.setup()
    const snapshot = await renderPendingWorkspace()
    const baseline = JSON.stringify(snapshot)
    const undo = () => screen.getByRole('button', { name: 'Undo latest change' })
    expect(undo()).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Review state' }), 'all')
    const login = () => screen.getByRole('option', { name: /Source POST \/auth\/login/ })
    await user.click(login())
    await user.click(screen.getByRole('button', { name: /^Accept$/ }))
    await user.click(login())
    await user.click(screen.getByRole('button', { name: /^Reject$/ }))
    await user.click(screen.getByRole('radio', { name: 'Wrong resource' }))
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    await user.click(undo())
    expect(login()).toHaveAttribute('data-state', 'accepted')
    expect(login()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('status', { name: 'Review announcement' })).toHaveTextContent(
      /is accepted/,
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '2 accepted relationships',
    )
    await user.click(undo())
    expect(login()).toHaveAttribute('data-state', 'pending')
    expect(screen.getByRole('status', { name: 'Review announcement' })).toHaveTextContent(
      /is pending/,
    )
    expect(undo()).toBeDisabled()
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      'No draft changes',
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '1 accepted relationship',
    )
    expect(JSON.stringify(snapshot)).toBe(baseline)
  })

  test('rejects an accepted candidate with a required reason and preserves declared edges', async () => {
    const user = userEvent.setup()
    await renderPendingWorkspace()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Review state' }), 'all')
    const login = () => screen.getByRole('option', { name: /Source POST \/auth\/login/ })
    await user.click(login())
    await user.click(screen.getByRole('button', { name: /^Accept$/ }))
    await user.click(login())
    await user.click(screen.getByRole('button', { name: /^Reject$/ }))
    const dialog = screen.getByRole('dialog', { name: 'Reject candidate' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose a reject reason')
    await user.click(within(dialog).getByRole('radio', { name: 'Wrong field' }))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(login()).toHaveAttribute('data-state', 'rejected')
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '1 accepted relationship',
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '2 review changes',
    )
    expect(screen.getByRole('status', { name: 'Review announcement' })).toHaveTextContent(
      'Rejected',
    )
  })

  test('blocks unsafe candidates and explains the blocker without creating a draft', async () => {
    const user = userEvent.setup()
    await renderPendingWorkspace()
    await user.click(screen.getByRole('option', { name: /Source GET \/spaces\/available/ }))
    expect(screen.getByRole('button', { name: /^Accept$/ })).toBeDisabled()
    expect(screen.getByRole('region', { name: 'Review Actions' })).toHaveTextContent(
      'requires an explicit item selector',
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      'No draft changes',
    )
  })

  test.each([
    ['invalid', 'Candidate mappings are invalid.'],
    ['stale', 'Candidate fingerprint changed.'],
    ['orphaned', 'Candidate is no longer present.'],
    ['conflict', 'Conflicting decisions share the highest revision.'],
  ] as const)('disables Accept and explains a %s candidate', async (state, reason) => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    render(
      <ReviewActions
        candidate={{ ...(await createPendingCandidateDetail()), state, outcomeReason: reason }}
        onAccept={onAccept}
        onReject={vi.fn()}
      />,
    )

    const accept = screen.getByRole('button', { name: /^Accept$/ })
    expect(accept).toBeDisabled()
    expect(screen.getByText(`Review state: ${state}`)).toBeVisible()
    expect(screen.getByText(reason)).toBeVisible()
    await user.click(accept)
    expect(onAccept).not.toHaveBeenCalled()
  })

  test('keeps a missing-node candidate out of the draft graph and reports the failed Accept', async () => {
    const user = userEvent.setup()
    const snapshot = await createPendingSnapshot()
    const candidate = snapshot.inferenceCandidates.find(({ sourceOperationKey }) =>
      sourceOperationKey.includes('/auth/login'),
    )!
    const graphWithoutTarget = {
      ...snapshot.declaredGraph,
      nodes: snapshot.declaredGraph.nodes.filter(
        ({ id }) => id !== candidate.targetOperationNodeId,
      ),
      edges: snapshot.declaredGraph.edges.filter(
        ({ sourceNodeId, targetNodeId }) =>
          sourceNodeId !== candidate.targetOperationNodeId &&
          targetNodeId !== candidate.targetOperationNodeId,
      ),
    }
    const missingNodeSnapshot = {
      ...snapshot,
      declaredGraph: graphWithoutTarget,
      acceptedGraph: graphWithoutTarget,
    }
    const baseline = JSON.stringify(missingNodeSnapshot)
    renderWorkspace(missingNodeSnapshot)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Review state' }), 'all')
    await user.click(screen.getByRole('option', { name: /Source POST \/auth\/login/ }))
    await user.click(screen.getByRole('button', { name: /^Accept$/ }))

    expect(screen.getByRole('button', { name: /^Accept$/ })).toBeDisabled()
    expect(screen.getByRole('region', { name: 'Review Actions' })).toHaveTextContent(
      'Candidate references a missing graph node.',
    )
    expect(screen.getByRole('status', { name: 'Review announcement' })).toHaveTextContent(
      'Accept was not applied',
    )
    await user.click(screen.getByRole('button', { name: 'Topology preview' }))
    expect(screen.getByRole('region', { name: 'Draft graph summary' })).toHaveTextContent(
      '0 inferred accepted',
    )
    expect(JSON.stringify(missingNodeSnapshot)).toBe(baseline)
  })

  test('accepts a pending candidate, preserves baseline data and advances to another pending row', async () => {
    const user = userEvent.setup()
    const snapshot = await renderPendingWorkspace()
    const baseline = JSON.stringify(snapshot)
    await user.click(screen.getByRole('option', { name: /Source POST \/auth\/login/ }))
    await user.click(screen.getByRole('button', { name: /^Accept$/ }))

    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '1 review change',
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '2 accepted relationships',
    )
    expect(screen.getByRole('status', { name: 'Review announcement' })).toHaveTextContent(
      /Accepted/,
    )
    expect(
      within(screen.getByRole('listbox')).getByRole('option', { selected: true }),
    ).toHaveAttribute('data-state', 'pending')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Review state' }), 'all')
    expect(screen.getByRole('option', { name: /Source POST \/auth\/login/ })).toHaveAttribute(
      'data-state',
      'accepted',
    )
    expect(JSON.stringify(snapshot)).toBe(baseline)
  })
})
