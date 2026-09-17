import { LanguageSwitcher } from './language-switcher'
import { useI18n } from './i18n'

export function WelcomeScreen({ onExploreSample }: { readonly onExploreSample: () => void }) {
  const { t } = useI18n()
  return (
    <main className="welcome-screen">
      <header className="welcome-screen__header">
        <div className="brand-mark" aria-hidden="true">
          ASF
        </div>
        <strong>API Schema Flow</strong>
        <LanguageSwitcher />
      </header>
      <div className="welcome-screen__content">
        <div className="welcome-screen__intro">
          <span className="eyebrow">{t('LOCAL API EXPLORATION')}</span>
          <h1>{t('Understand an API through a task')}</h1>
          <p>
            {t(
              'Inspect endpoints, review suggested data handoffs, build a workflow and save your decisions locally.',
            )}
          </p>
        </div>
        <div className="welcome-screen__choices">
          <section className="welcome-card welcome-card--sample">
            <span className="eyebrow">{t('START HERE')}</span>
            <h2>{t('Explore the Reservation sample')}</h2>
            <p>
              {t(
                'A four-endpoint example for learning the review and workflow tools. Suggestions are shown as candidates until you accept them.',
              )}
            </p>
            <button type="button" className="primary-button" onClick={onExploreSample}>
              {t('Explore sample workspace')}
            </button>
          </section>
          <section className="welcome-card">
            <span className="eyebrow">{t('YOUR API')}</span>
            <h2>{t('Open a local OpenAPI file')}</h2>
            <p>
              {t(
                'Build once, then import the fictional Commerce API. Replace its path with your own local file when ready; the CLI prints a private URL.',
              )}
            </p>
            <code>pnpm build</code>
            <code>
              node packages/cli/bin/schema-flow.mjs open examples/demo-commerce/openapi.yaml
            </code>
          </section>
          <section className="welcome-card">
            <span className="eyebrow">{t('CONTINUE LATER')}</span>
            <h2>{t('Reopen a saved project')}</h2>
            <p>
              {t(
                'A Project JSON does not contain the OpenAPI source. Pass the same source file and your backup; inspect the preview before applying it.',
              )}
            </p>
            <code>
              node packages/cli/bin/schema-flow.mjs open ./path/to/openapi.yaml --project
              ./schema-flow-project.json
            </code>
          </section>
        </div>
        <p className="welcome-screen__note">
          {t('The workspace stays on your computer. Local Mock does not call your API.')}
        </p>
      </div>
    </main>
  )
}
