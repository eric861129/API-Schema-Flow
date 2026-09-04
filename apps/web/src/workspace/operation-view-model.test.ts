import { describe, expect, test } from 'vitest'

import { createReviewWorkspaceFixture } from '../test/review-workspace-fixture'
import { buildOperationViewModels, filterOperationViewModels } from './operation-view-model'

const snapshot = createReviewWorkspaceFixture()

describe('operation view model', () => {
  test('builds deterministic connection metadata and searches path, summary, and operation ID', () => {
    const models = buildOperationViewModels(snapshot)
    expect(models[0]).toMatchObject({ tag: 'Reservations', incoming: 0, outgoing: 0 })
    expect(
      filterOperationViewModels(models, { query: 'createReservation', methods: [] }),
    ).toHaveLength(1)
    expect(
      filterOperationViewModels(models, { query: 'reservation', methods: ['get'] }),
    ).toHaveLength(0)
  })
})
