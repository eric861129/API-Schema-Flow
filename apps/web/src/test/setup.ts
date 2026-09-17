import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { LOCALE_STORAGE_KEY, i18n } from '../i18n'

beforeEach(() => {
  void i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  localStorage.removeItem(LOCALE_STORAGE_KEY)
  void i18n.changeLanguage('en')
  document.documentElement.lang = 'en'
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverMock, writable: true })
Object.defineProperty(globalThis, 'DOMMatrixReadOnly', {
  value: class DOMMatrixReadOnlyMock {},
  writable: true,
})
