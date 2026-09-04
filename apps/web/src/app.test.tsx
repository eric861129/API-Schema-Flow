import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { App } from './app'
import { createReviewWorkspaceFixture } from './test/review-workspace-fixture'

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function stubWorkspace(value = createReviewWorkspaceFixture()) {
  const fetcher = vi.fn(async () => jsonResponse(value))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App composition boundary', () => {
  test('keeps loading and no-operation states outside the workspace shell', async () => {
    stubWorkspace(createReviewWorkspaceFixture({ operations: [], nodes: [] }))

    render(<App />)

    expect(screen.getByText('Loading Reservation workspace…')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'No API operations' })).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('main', { name: 'API Schema Flow workspace' }),
    ).not.toBeInTheDocument()
  })

  test('keeps error and retry behavior in App before rendering the workspace shell', async () => {
    const user = userEvent.setup()
    const snapshot = createReviewWorkspaceFixture()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse(snapshot))
    vi.stubGlobal('fetch', fetcher)

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Workspace unavailable' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The Reservation workspace could not be loaded. Check the local server and retry.',
      ),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry loading fixture' }))

    expect(await screen.findByRole('main', { name: 'API Schema Flow workspace' })).toBeVisible()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('renders WorkspaceShell for a valid non-empty review snapshot', async () => {
    const snapshot = createReviewWorkspaceFixture()
    stubWorkspace(snapshot)

    render(<App />)

    const workspace = await screen.findByRole('main', { name: 'API Schema Flow workspace' })
    expect(workspace).toBeVisible()
    expect(screen.getByText(snapshot.project.name)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Inference Review' })).toBeVisible()
  })
})
