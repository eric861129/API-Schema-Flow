import { describe, expect, test } from 'vitest'

import * as openApi from '../../src/index.js'

const resolveJsonPointer = Reflect.get(openApi, 'resolveJsonPointer') as
  | ((document: unknown, pointer: string) => { found: boolean; value?: unknown; reason?: string })
  | undefined

describe('JSON Pointer resolution', () => {
  test('resolves root, escaped object keys, and array elements', () => {
    expect(resolveJsonPointer).toEqual(expect.any(Function))
    if (typeof resolveJsonPointer !== 'function') return

    const document = {
      nested: {
        'slash/key': {
          '~token': ['resolved'],
        },
      },
    }

    expect(resolveJsonPointer(document, '#')).toEqual({ found: true, value: document })
    expect(resolveJsonPointer(document, '#/nested/slash~1key/~0token/0')).toEqual({
      found: true,
      value: 'resolved',
    })
  })

  test('returns structured misses for absent and invalid pointers', () => {
    expect(resolveJsonPointer).toEqual(expect.any(Function))
    if (typeof resolveJsonPointer !== 'function') return

    expect(resolveJsonPointer({ value: 1 }, '#/missing')).toMatchObject({ found: false })
    expect(resolveJsonPointer({ value: 1 }, '#not-a-pointer')).toMatchObject({ found: false })
    expect(resolveJsonPointer(['only'], '#/2')).toMatchObject({ found: false })
  })
})
