import { describe, expect, test } from 'vitest'

import * as sourceLoader from '../../src/index.js'

const isBlockedIpAddress = Reflect.get(sourceLoader, 'isBlockedIpAddress') as
  ((address: string) => boolean) | undefined

describe('IP retrieval policy', () => {
  test.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
  ])('blocks non-public address %s', (address) => {
    expect(isBlockedIpAddress).toEqual(expect.any(Function))
    if (typeof isBlockedIpAddress !== 'function') return
    expect(isBlockedIpAddress(address)).toBe(true)
  })

  test.each(['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111'])(
    'allows public address %s',
    (address) => {
      expect(isBlockedIpAddress).toEqual(expect.any(Function))
      if (typeof isBlockedIpAddress !== 'function') return
      expect(isBlockedIpAddress(address)).toBe(false)
    },
  )

  test('blocks malformed addresses defensively', () => {
    expect(isBlockedIpAddress).toEqual(expect.any(Function))
    if (typeof isBlockedIpAddress !== 'function') return
    expect(isBlockedIpAddress('not-an-ip')).toBe(true)
  })
})
