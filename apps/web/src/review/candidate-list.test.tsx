import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { CandidateList } from './candidate-list'
import type { ReviewCandidateRow } from './review-selectors'

const candidates: readonly ReviewCandidateRow[] = [
  {
    id: 'candidate:reservation',
    sourceOperationKey: 'operation:post:/reservations',
    sourceLabel: 'POST /reservations',
    sourceSelector: '$response.body#/reservationId',
    targetOperationKey: 'operation:get:/reservations/{id}',
    targetLabel: 'GET /reservations/{id}',
    targetDescriptor: 'path.id',
    confidence: 0.94,
    band: 'high',
    evidenceCount: 4,
    blockerCount: 0,
    state: 'pending',
  },
  {
    id: 'candidate:token',
    sourceOperationKey: 'operation:post:/auth/login',
    sourceLabel: 'POST /auth/login',
    sourceSelector: '$response.body#/token',
    targetOperationKey: 'operation:post:/reservations',
    targetLabel: 'POST /reservations',
    targetDescriptor: 'header.Authorization',
    confidence: 0.91,
    band: 'high',
    evidenceCount: 3,
    blockerCount: 1,
    state: 'conflict',
  },
]

describe('CandidateList', () => {
  test('renders textual confidence, review state, evidence, and blockers', () => {
    render(
      <CandidateList
        candidates={candidates}
        selectedCandidateId="candidate:reservation"
        onSelect={() => undefined}
      />,
    )

    expect(screen.getByRole('listbox')).toHaveAccessibleName('Inference candidates, 2 visible')
    expect(screen.getByText('High · 94%')).toBeVisible()
    expect(screen.getByText('Pending')).toBeVisible()
    expect(screen.getByText('4 evidence')).toBeVisible()
    expect(screen.getByText('⚠ 1 blockers')).toBeVisible()
    expect(screen.getByRole('option', { name: /^Source POST \/reservations/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('selects a candidate and supports Arrow, Home, and End focus movement', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CandidateList candidates={candidates} selectedCandidateId={null} onSelect={onSelect} />)

    const options = screen.getAllByRole('option')
    options[0]?.focus()
    await user.keyboard('{ArrowDown}')
    expect(options[1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(options[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(options[1]).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('candidate:token')
  })

  test('renders a concrete filter-empty state', () => {
    render(
      <CandidateList
        candidates={[]}
        selectedCandidateId={null}
        onSelect={() => undefined}
        emptyMessage="Clear the confidence filters to see more candidates."
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('No review candidates')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Clear the confidence filters to see more candidates.',
    )
  })
})
