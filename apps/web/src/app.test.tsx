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
  window.history.replaceState(null, '', '/')
})

describe('App composition boundary', () => {
  test('loads the private local snapshot using the fragment token', async () => {
    window.history.replaceState(null, '', '/#workspace=local-token')
    const fetcher = stubWorkspace()
    render(<App />)
    await screen.findByRole('main', { name: 'API Schema Flow workspace' })
    expect(fetcher).toHaveBeenCalledWith('/api/workspace', {
      headers: { Authorization: 'Bearer local-token' },
      cache: 'no-store',
    })
  })

  test('does not fall back to the demo when the local token is rejected', async () => {
    window.history.replaceState(null, '', '/#workspace=expired')
    const fetcher = vi.fn(async () => new Response('Forbidden', { status: 403 }))
    vi.stubGlobal('fetch', fetcher)
    render(<App />)
    await screen.findByRole('heading', { name: 'Workspace unavailable' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Reservation System')).not.toBeInTheDocument()
  })
  test('keeps loading and no-operation states outside the workspace shell', async () => {
    stubWorkspace(createReviewWorkspaceFixture({ operations: [], nodes: [] }))

    render(<App />)

    expect(screen.getByText('Loading API workspace…')).toBeInTheDocument()
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
      screen.getByText('The API workspace could not be loaded. Check the local server and retry.'),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry loading workspace' }))

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
