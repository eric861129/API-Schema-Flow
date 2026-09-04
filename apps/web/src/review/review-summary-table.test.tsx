import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { ReviewCandidateRow } from './review-selectors'
import { ReviewSummaryTable } from './review-summary-table'

const rows: readonly ReviewCandidateRow[] = [
  {
    id: 'candidate:reservation',
    sourceOperationKey: 'operation:post:/reservations',
    sourceLabel: 'POST /reservations',
    sourceSelector: '$response.body#/id',
    targetOperationKey: 'operation:get:/reservations/{id}',
    targetLabel: 'GET /reservations/{id}',
    targetDescriptor: 'path.id',
    confidence: 0.98,
    band: 'high',
    evidenceCount: 2,
    blockerCount: 0,
    state: 'pending',
  },
  {
    id: 'candidate:space',
    sourceOperationKey: 'operation:get:/spaces/available',
    sourceLabel: 'GET /spaces/available',
    sourceSelector: '$response.body#/id',
    targetOperationKey: 'operation:post:/reservations',
    targetLabel: 'POST /reservations',
    targetDescriptor: 'requestBody#/spaceId',
    confidence: 0.84,
    band: 'medium',
    evidenceCount: 2,
    blockerCount: 1,
    state: 'edited',
  },
]

describe('ReviewSummaryTable', () => {
  test('provides a semantic non-spatial candidate summary and selected-row state', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ReviewSummaryTable
        candidates={rows}
        selectedCandidateId="candidate:space"
        onSelect={onSelect}
      />,
    )

    const table = screen.getByRole('table', { name: 'Review candidate summary' })
    for (const heading of ['Source', 'Target', 'Confidence', 'State', 'Evidence', 'Blockers']) {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeVisible()
    }

    const spaceButton = within(table).getByRole('button', { name: /GET \/spaces\/available/i })
    expect(spaceButton).toHaveAttribute('aria-current', 'true')
    expect(within(table).getByText('Medium · 84%')).toBeVisible()
    expect(within(table).getByText('Edited')).toBeVisible()

    await user.click(within(table).getByRole('button', { name: /POST \/reservations/i }))
    expect(onSelect).toHaveBeenCalledWith('candidate:reservation')
  })
})
