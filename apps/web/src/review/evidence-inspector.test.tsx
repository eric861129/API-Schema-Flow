import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { EvidenceInspector } from './evidence-inspector'
import type { ReviewCandidateDetail } from './review-detail'

const candidate: ReviewCandidateDetail = {
  id: 'candidate:reservation',
  sourceOperationKey: 'operation:post:/reservations',
  sourceLabel: 'POST /reservations',
  sourceSelector: '$response.body#/reservationId',
  targetOperationKey: 'operation:get:/reservations/{id}',
  targetLabel: 'GET /reservations/{id}',
  targetDescriptor: 'path.id',
  confidence: 0.94,
  band: 'high',
  evidenceCount: 3,
  blockerCount: 1,
  state: 'pending',
  ruleSetVersion: '1.0.0',
  fingerprint: 'fingerprint:reservation',
  sourceSchema: { type: 'string', format: 'uuid' },
  targetSchema: { type: 'string', format: 'uuid', required: true },
  evidence: [
    {
      ruleId: 'INF-RESOURCE-ID',
      kind: 'positive',
      weight: 25,
      summary: 'Resource-qualified IDs match.',
      sourcePointers: ['fixture://reservation/openapi.yaml#/paths/~1reservations/post'],
    },
    {
      ruleId: 'INF-SCHEMA-TYPE',
      kind: 'positive',
      weight: 12,
      summary: 'Schema types match.',
      sourcePointers: [],
    },
    {
      ruleId: 'INF-CYCLE-RISK',
      kind: 'negative',
      weight: -8,
      summary: 'The mapping may create a cycle.',
      sourcePointers: [],
    },
  ],
  blockers: [
    {
      code: 'INF-BLOCK-ARRAY-SELECTOR',
      summary: 'An explicit array selector is required.',
      sourcePointers: ['fixture://reservation/openapi.yaml#/components/schemas/ReservationList'],
    },
  ],
}

describe('EvidenceInspector', () => {
  test('is absent when closed or no candidate is selected', () => {
    const { rerender } = render(
      <EvidenceInspector candidate={candidate} open={false} onClose={() => undefined} />,
    )
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()

    rerender(<EvidenceInspector candidate={null} open onClose={() => undefined} />)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  test('shows confidence, evidence groups, blockers, source pointers, and identity', () => {
    render(<EvidenceInspector candidate={candidate} open onClose={() => undefined} />)

    expect(screen.getByRole('heading', { name: 'Why this mapping was suggested' })).toBeVisible()
    expect(screen.getByText('high · 94%')).toBeVisible()
    expect(screen.getByText('INF-BLOCK-ARRAY-SELECTOR')).toBeVisible()
    expect(screen.getByText('INF-RESOURCE-ID')).toBeVisible()
    expect(screen.getByText('+25')).toBeVisible()
    expect(screen.getByText('INF-CYCLE-RISK')).toBeVisible()
    expect(screen.getByText('-8')).toBeVisible()
    expect(
      screen.getByText('fixture://reservation/openapi.yaml#/paths/~1reservations/post'),
    ).toBeVisible()
    expect(screen.getByText(/candidate, not an authoritative/i)).toBeVisible()
    expect(screen.getByText('Candidate identity')).toBeVisible()
  })

  test('closes through its accessible action', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<EvidenceInspector candidate={candidate} open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close evidence' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
