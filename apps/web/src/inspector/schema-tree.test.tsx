import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { NormalizedSchema } from '@api-schema-flow/domain'
import { SchemaTree } from './schema-tree'

const source = { uri: 'fixture://reservation.yaml', pointer: '#/components/schemas/Reservation' }
const empty = {
  required: [],
  properties: {},
  enumValues: [],
  allOf: [],
  anyOf: [],
  oneOf: [],
  nullable: false,
  readOnly: false,
  writeOnly: false,
  deprecated: false,
} as const
const id: NormalizedSchema = {
  ...empty,
  source: { ...source, pointer: `${source.pointer}/properties/id` },
  types: ['string'],
  format: 'uuid',
}
const component: NormalizedSchema = {
  ...empty,
  source,
  types: ['object'],
  required: ['id'],
  properties: { id },
}
const reference: NormalizedSchema = {
  ...empty,
  source: { uri: source.uri, pointer: '#/paths/~1reservations/get/responses/200' },
  ref: '#/components/schemas/Reservation',
  resolvedRef: source,
  types: [],
}

describe('SchemaTree', () => {
  test('shows fields behind a resolved reference with required and format information', () => {
    render(<SchemaTree schema={reference} resolve={() => component} />)
    fireEvent.click(screen.getByRole('button', { name: /Body/i }))

    expect(screen.getByText('id')).toBeVisible()
    expect(screen.getByText('string · uuid')).toBeVisible()
    expect(screen.getByText('Required')).toBeVisible()
  })
})
