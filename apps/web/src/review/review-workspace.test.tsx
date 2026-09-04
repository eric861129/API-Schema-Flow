import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { loadWorkspaceSnapshot } from '../data/load-workspace'
import { createReviewWorkspaceFixture } from '../test/review-workspace-fixture'
import { ReviewSessionProvider } from './review-session-context'
import { ReviewWorkspace } from './review-workspace'

function renderWorkspace(snapshot = createReviewWorkspaceFixture()) {
  return render(
    <ReviewSessionProvider snapshot={snapshot}>
      <ReviewWorkspace />
    </ReviewSessionProvider>,
  )
}

describe('ReviewWorkspace skeleton', () => {
  test('renders semantic review regions with concrete empty and no-selection states', () => {
    renderWorkspace()

    expect(screen.getByRole('region', { name: 'Inference Review workspace' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Inference Review' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Candidate List' })).toHaveTextContent(
      'No inference candidates are available in this snapshot.',
    )
    expect(screen.getByRole('region', { name: 'Mapping or Topology Preview' })).toHaveTextContent(
      'Select an inference candidate to preview its mapping or topology.',
    )
    expect(screen.getByRole('region', { name: 'Evidence Inspector' })).toHaveTextContent(
      'Select an inference candidate to inspect its evidence.',
    )
    expect(screen.getByRole('region', { name: 'Review Actions' })).toHaveTextContent(
      'Review actions become available after a candidate is selected.',
    )
    expect(screen.getByRole('region', { name: 'Review Summary' })).toHaveTextContent('0 candidates')
    expect(screen.getByRole('status', { name: 'Review status' })).toHaveTextContent(
      '0 unsaved decisions',
    )
  })

  test('consumes projected candidates and materialized graph without exposing deferred controls', async () => {
    const snapshot = await loadWorkspaceSnapshot(
      '/fixture.json',
      async () =>
        new Response(JSON.stringify(rawSnapshot), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    renderWorkspace(snapshot)

    expect(screen.getByRole('region', { name: 'Candidate List' })).toHaveTextContent(
      `${snapshot.inferenceCandidates.length} inference candidates available.`,
    )
    expect(screen.getByRole('region', { name: 'Review Summary' })).toHaveTextContent(
      `${snapshot.inferenceCandidates.length} candidates`,
    )
    expect(screen.getByRole('status', { name: 'Review status' })).toHaveTextContent(
      `${snapshot.acceptedGraph.edges.length} accepted relationships`,
    )

    for (const name of ['Accept', 'Reject', 'Edit', 'Save', 'Import', 'Export', 'Run', 'Mock']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })
})
