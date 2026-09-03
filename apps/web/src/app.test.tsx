import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { App } from './app'

const snapshot = {
  schemaVersion: '1.0',
  project: {
    name: 'Reservation System',
    sourceName: 'Reservation API',
    sourceUri: 'fixture://reservation/openapi.yaml',
    openapiVersion: '3.1.0',
  },
  apiDocument: { operations: [] },
  acceptedGraph: { id: 'graph', nodes: [], edges: [] },
  inferenceCandidates: [],
  reviewOutcomes: [],
  diagnostics: [],
}

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

test('renders a concrete empty state after loading a valid empty workspace', async () => {
  render(<App />)
  expect(screen.getByText('Loading Reservation workspace…')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'No API operations' })).toBeInTheDocument(),
  )
})
