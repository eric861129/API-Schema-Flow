import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { loadWorkspaceSnapshot } from '../data/load-workspace'
import { DraftGraphPreview } from './draft-graph-preview'

describe('DraftGraphPreview', () => {
  test('labels the graph as unsaved and reports accepted provenance separately', async () => {
    const snapshot = await loadWorkspaceSnapshot(
      '/fixture.json',
      async () => new Response(JSON.stringify(rawSnapshot)),
    )
    const graphBefore = JSON.stringify(snapshot.acceptedGraph)
    render(
      <DraftGraphPreview snapshot={snapshot} graph={snapshot.acceptedGraph} pendingCount={2} />,
    )

    const summary = screen.getByRole('region', { name: 'Draft graph summary' })
    expect(summary).toHaveTextContent('1 declared accepted')
    expect(summary).toHaveTextContent('1 inferred accepted')
    expect(summary).toHaveTextContent('1 manual accepted')
    expect(summary).toHaveTextContent('2 pending candidates outside the graph')
    expect(
      await screen.findByRole('region', { name: 'Draft review preview — not saved' }),
    ).toBeVisible()
    expect(JSON.stringify(snapshot.acceptedGraph)).toBe(graphBefore)
  })
})
