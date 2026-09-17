import { SUPPORTED_LOCALES, type Locale, useI18n } from './i18n'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <label className="language-switcher">
      <span className="sr-only">{t('Interface language')}</span>
      <select
        aria-label={t('Interface language')}
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((value) => (
          <option key={value} value={value}>
            {t(value === 'zh-TW' ? 'Traditional Chinese' : 'English')}
          </option>
        ))}
      </select>
    </label>
  )
}
