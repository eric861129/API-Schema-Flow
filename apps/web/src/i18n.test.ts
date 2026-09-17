import { describe, expect, test, vi } from 'vitest'
import {
  changeLocale,
  i18n,
  localizeRawMessage,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
} from './i18n'

describe('interface language preferences', () => {
  test('defaults to Traditional Chinese and only accepts supported stored languages', () => {
    localStorage.removeItem(LOCALE_STORAGE_KEY)
    expect(readStoredLocale()).toBe('zh-TW')
    for (const value of ['en', 'zh-TW', 'unknown']) {
      localStorage.setItem(LOCALE_STORAGE_KEY, value)
      expect(readStoredLocale()).toBe(value === 'en' ? 'en' : 'zh-TW')
    }
  })

  test('remains usable when browser storage access is denied', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })
    expect(readStoredLocale()).toBe('zh-TW')
    read.mockRestore()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })
    try {
      expect(() => changeLocale('zh-TW')).not.toThrow()
      expect(document.documentElement.lang).toBe('zh-TW')
      expect(i18n.t('Interface language')).toBe('介面語言')
    } finally {
      write.mockRestore()
    }
  })

  test('keeps interpolation parameters intact in both language resources', () => {
    const english = i18n.getResourceBundle('en', 'translation') as Record<string, string>
    const chinese = i18n.getResourceBundle('zh-TW', 'translation') as Record<string, string>
    expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort())
    const parameters = (message: string) =>
      [...message.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]).sort()
    for (const key of Object.keys(english)) {
      expect(parameters(chinese[key]!), key).toEqual(parameters(english[key]!))
    }
    changeLocale('zh-TW')
    expect(
      localizeRawMessage('Imported mapping is incompatible: type mismatch', i18n.t),
    ).not.toContain('{{')
    expect(localizeRawMessage('Imported mapping is incompatible: type mismatch', i18n.t)).toContain(
      'type mismatch',
    )
  })
})
