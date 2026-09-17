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
  test('starts with a clear sample, source and reopen choice', async () => {
    stubWorkspace()
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Understand an API through a task' })).toBeVisible()
    expect(screen.getByText(/--project/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Explore sample workspace' }))
    expect(await screen.findByRole('main', { name: 'API Schema Flow workspace' })).toBeVisible()
    expect(window.location.search).toBe('?sample=1')
  })

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
    expect(screen.getByText(/local link expires/)).toBeVisible()
  })
  test('does not show the workspace when a requested backup cannot be retrieved', async () => {
    window.history.replaceState(null, '', '/#workspace=local-token&project=1')
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(createReviewWorkspaceFixture()))
      .mockResolvedValueOnce(new Response('Missing', { status: 404 }))
    vi.stubGlobal('fetch', fetcher)
    render(<App />)
    expect(
      await screen.findByText('The saved project could not be loaded (HTTP 404).'),
    ).toBeVisible()
    expect(
      screen.queryByRole('main', { name: 'API Schema Flow workspace' }),
    ).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/project', {
      headers: { Authorization: 'Bearer local-token' },
      cache: 'no-store',
    })
  })
  test('keeps loading and no-operation states outside the workspace shell', async () => {
    window.history.replaceState(null, '', '/?sample=1')
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
    window.history.replaceState(null, '', '/?sample=1')
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
    window.history.replaceState(null, '', '/?sample=1')
    const snapshot = createReviewWorkspaceFixture()
    stubWorkspace(snapshot)

    render(<App />)

    const workspace = await screen.findByRole('main', { name: 'API Schema Flow workspace' })
    expect(workspace).toBeVisible()
    expect(screen.getByText(snapshot.project.name)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Inference Review' })).toBeVisible()
  })
})
