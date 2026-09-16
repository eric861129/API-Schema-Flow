import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { ReviewStatusBar } from './review-status-bar'

describe('ReviewStatusBar', () => {
  test('distinguishes a clean session from review changes and exposes Undo', async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn()
    const view = render(
      <ReviewStatusBar
        draftCount={0}
        edgeCount={1}
        selectedId={null}
        announcement=""
        onUndo={onUndo}
      />,
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      'No draft changes',
    )
    expect(screen.getByRole('button', { name: 'Undo latest change' })).toBeDisabled()
    expect(
      screen.getByText('Local storage unavailable. Export decisions before closing.'),
    ).toBeVisible()

    view.rerender(
      <ReviewStatusBar
        draftCount={2}
        edgeCount={3}
        selectedId="candidate:one"
        announcement="Rejected candidate."
        onUndo={onUndo}
      />,
    )
    expect(screen.getByRole('region', { name: 'Review status' })).toHaveTextContent(
      '2 review changes',
    )
    expect(screen.getByRole('status', { name: 'Review announcement' })).toHaveTextContent(
      'Rejected candidate.',
    )
    await user.click(screen.getByRole('button', { name: 'Undo latest change' }))
    expect(onUndo).toHaveBeenCalledOnce()
  })
})
