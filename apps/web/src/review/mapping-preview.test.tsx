import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { MappingPreview } from './mapping-preview'
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
  evidenceCount: 2,
  blockerCount: 0,
  state: 'pending',
  ruleSetVersion: '1.0.0',
  fingerprint: 'fingerprint:reservation',
  sourceSchema: { type: 'string', format: 'uuid' },
  targetSchema: { type: 'string', format: 'uuid', required: true },
  alias: 'reservationId',
  evidence: [],
  blockers: [],
}

describe('MappingPreview', () => {
  test('asks for a candidate when no mapping is selected', () => {
    render(<MappingPreview candidate={null} />)

    expect(screen.getByRole('heading', { name: 'Select an inference candidate' })).toBeVisible()
  })

  test('shows source, target, schema compatibility, confidence, and review warning', () => {
    render(<MappingPreview candidate={candidate} />)

    expect(screen.getByRole('heading', { name: 'Review inferred data transfer' })).toBeVisible()
    expect(screen.getByText('POST /reservations')).toBeVisible()
    expect(screen.getByText('$response.body#/reservationId')).toBeVisible()
    expect(screen.getByText('GET /reservations/{id}')).toBeVisible()
    expect(screen.getByText('path.id')).toBeVisible()
    expect(screen.getByText('high · 94%')).toBeVisible()
    expect(screen.getByText('Type compatible · string')).toBeVisible()
    expect(screen.getByText('Format compatible · uuid')).toBeVisible()
    expect(screen.getByText('Target value is required')).toBeVisible()
    expect(screen.getByText(/not an authoritative workflow relationship/i)).toBeVisible()
  })

  test('contains no editable mapping controls', () => {
    render(<MappingPreview candidate={candidate} />)

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { loadWorkspaceSnapshot } from '../data/load-workspace'
import { createInitialReviewSession } from './review-session'
import { materializeReviewSession } from './review-engine'
import { projectReviewWorkspace } from './review-workspace-adapter'

async function canonicalDetails() {
  const snapshot = await loadWorkspaceSnapshot(
    '/fixture.json',
    async () =>
      new Response(JSON.stringify(rawSnapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
  const session = createInitialReviewSession({
    projectFingerprint: snapshot.reviewContext.projectFingerprint,
    sourceRevision: snapshot.reviewContext.sourceRevision,
  })
  const projection = projectReviewWorkspace(snapshot, materializeReviewSession(snapshot, session))
  return projection
}

describe('MappingPreview Domain projection', () => {
  test('renders resolved source/target schema details, array depth, transform, and warnings', async () => {
    const projection = await canonicalDetails()
    const spaceCandidate = [...projection.details.values()].find(
      (candidate) => candidate.sourceLabel === 'GET /spaces/available',
    )!
    const tokenCandidate = [...projection.details.values()].find(
      (candidate) => candidate.sourceLabel === 'POST /auth/login',
    )!

    const view = render(<MappingPreview candidate={spaceCandidate} />)
    expect(screen.getByText('GET /spaces/available')).toBeVisible()
    expect(screen.getByText('$response.body#/id')).toBeVisible()
    expect(screen.getByText('POST /reservations')).toBeVisible()
    expect(screen.getByText('requestBody#/spaceId')).toBeVisible()
    expect(screen.getAllByText(/string · uuid/i)).toHaveLength(2)
    expect(screen.getByText(/array at depth 1/i)).toBeVisible()
    expect(screen.getByText(/explicit item selector/i)).toBeVisible()

    view.rerender(<MappingPreview candidate={tokenCandidate} />)
    expect(screen.getByText('Bearer {$steps.source.outputs.token}')).toBeVisible()
    expect(screen.getByText(/Target value is required/i)).toBeVisible()
    expect(screen.getByText(/not an authoritative workflow relationship/i)).toBeVisible()
  })
})
