import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { ReviewFilters } from './review-filters'
import type { ReviewSessionFilters } from './review-session'

const filters: ReviewSessionFilters = {
  query: 'reserv',
  confidenceBands: ['high', 'medium'],
  reviewState: 'pending',
  hasBlockersOnly: false,
}

describe('ReviewFilters', () => {
  test('exposes query, confidence, state, blockers, sorting, and visible count controls', async () => {
    const user = userEvent.setup()
    const onQueryChange = vi.fn()
    const onToggleConfidence = vi.fn()
    const onReviewStateChange = vi.fn()
    const onBlockersOnlyChange = vi.fn()
    const onSortChange = vi.fn()
    const onReset = vi.fn()

    render(
      <ReviewFilters
        filters={filters}
        sort="confidence-desc"
        visibleCount={2}
        totalCount={4}
        empty={false}
        searchInputRef={createRef<HTMLInputElement>()}
        onQueryChange={onQueryChange}
        onToggleConfidence={onToggleConfidence}
        onReviewStateChange={onReviewStateChange}
        onBlockersOnlyChange={onBlockersOnlyChange}
        onSortChange={onSortChange}
        onReset={onReset}
      />,
    )

    expect(screen.getByRole('searchbox', { name: 'Search review candidates' })).toHaveValue(
      'reserv',
    )
    expect(screen.getByText('2 of 4 candidates')).toBeVisible()
    expect(screen.getByRole('button', { name: 'High confidence' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Low confidence' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Low confidence' }))
    expect(onToggleConfidence).toHaveBeenCalledWith('low')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Review state' }), 'accepted')
    expect(onReviewStateChange).toHaveBeenCalledWith('accepted')

    await user.click(screen.getByRole('checkbox', { name: 'Has blockers only' }))
    expect(onBlockersOnlyChange).toHaveBeenCalledWith(true)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort candidates' }),
      'target-endpoint',
    )
    expect(onSortChange).toHaveBeenCalledWith('target-endpoint')

    await user.clear(screen.getByRole('searchbox', { name: 'Search review candidates' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search review candidates' }), 'token')
    expect(onQueryChange).toHaveBeenCalled()
  })

  test('shows a concrete filter-empty recovery action', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()

    render(
      <ReviewFilters
        filters={{ ...filters, query: 'missing' }}
        sort="confidence-desc"
        visibleCount={0}
        totalCount={4}
        empty
        searchInputRef={createRef<HTMLInputElement>()}
        onQueryChange={() => undefined}
        onToggleConfidence={() => undefined}
        onReviewStateChange={() => undefined}
        onBlockersOnlyChange={() => undefined}
        onSortChange={() => undefined}
        onReset={onReset}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'No candidates match the current review filters.',
    )
    await user.click(screen.getByRole('button', { name: 'Reset review filters' }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
