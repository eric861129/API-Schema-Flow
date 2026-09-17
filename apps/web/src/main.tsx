import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'

import { App } from './app'
import { i18n } from './i18n'
import './styles.css'
import './review/review-task7.css'

const root = document.querySelector('#root')

if (!(root instanceof HTMLElement)) {
  throw new Error('Missing #root element')
}

createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
)
