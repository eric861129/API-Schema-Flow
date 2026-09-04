import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { App } from './app'
import { createReviewWorkspaceFixture } from './test/review-workspace-fixture'

const snapshot = createReviewWorkspaceFixture({ operations: [], nodes: [] })

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  )
})

test('renders a concrete empty state after loading a valid empty review workspace', async () => {
  render(<App />)
  expect(screen.getByText('Loading Reservation workspace…')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'No API operations' })).toBeInTheDocument(),
  )
})
