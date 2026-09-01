import { describe, expect, test } from 'vitest'

import { REDACTED_VALUE, redactHeaders, redactSecrets, redactText } from '../../src/index.js'

describe('secret redaction', () => {
  test('redacts common headers case-insensitively', () => {
    expect(
      redactHeaders({
        Authorization: 'Bearer secret-token',
        Cookie: 'session=secret',
        'X-API-Key': 'key-123',
        Accept: 'application/json',
      }),
    ).toEqual({
      Authorization: REDACTED_VALUE,
      Cookie: REDACTED_VALUE,
      'X-API-Key': REDACTED_VALUE,
      Accept: 'application/json',
    })
  })

  test('redacts nested object and array values without mutating input', () => {
    const input = {
      accessToken: 'access-secret',
      profile: {
        refresh_token: 'refresh-secret',
        monkey: 'banana',
      },
      sessions: [{ token: 'session-secret' }],
    }
    const original = structuredClone(input)

    expect(redactSecrets(input)).toEqual({
      accessToken: REDACTED_VALUE,
      profile: {
        refresh_token: REDACTED_VALUE,
        monkey: 'banana',
      },
      sessions: [{ token: REDACTED_VALUE }],
    })
    expect(input).toEqual(original)
  })

  test('redacts credential-shaped fragments in error text', () => {
    expect(redactText('Authorization: Bearer abc123; api_key=hidden')).toBe(
      `Authorization: Bearer ${REDACTED_VALUE}; api_key=${REDACTED_VALUE}`,
    )
  })
})
