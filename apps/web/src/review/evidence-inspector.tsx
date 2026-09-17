import { groupReviewEvidence, type ReviewCandidateDetail } from './review-detail'
import type { ProjectedReviewCandidateDetail } from './review-workspace-adapter'
import { useI18n } from '../i18n'

export interface EvidenceInspectorProps {
  readonly candidate: ReviewCandidateDetail | ProjectedReviewCandidateDetail | null
  readonly open: boolean
  readonly onClose: () => void
}

const GROUP_LABELS = {
  positive: 'Positive evidence',
  negative: 'Negative evidence',
  neutral: 'Supporting context',
} as const

export function EvidenceInspector({ candidate, open, onClose }: EvidenceInspectorProps) {
  const { localize, t } = useI18n()
  if (!candidate || !open) {
    return null
  }

  const groups = groupReviewEvidence(candidate)

  return (
    <aside className="evidence-inspector" aria-labelledby="evidence-title">
      <header className="evidence-inspector__header">
        <div>
          <p className="section-label">{t('Inference evidence')}</p>
          <h2 id="evidence-title">{t('Why this mapping was suggested')}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={t('Close evidence')}
        >
          ×
        </button>
      </header>

      <dl className="evidence-inspector__summary">
        <div>
          <dt>{t('Confidence')}</dt>
          <dd>
            {candidate.band} · {Math.round(candidate.confidence * 100)}%
          </dd>
        </div>
        <div>
          <dt>{t('Rule set')}</dt>
          <dd>{candidate.ruleSetVersion}</dd>
        </div>
        <div>
          <dt>{t('State')}</dt>
          <dd>{candidate.state}</dd>
        </div>
      </dl>

      <p className="evidence-inspector__notice">
        {t('This inference is a candidate, not an authoritative workflow fact.')}
      </p>

      {candidate.blockers.length > 0 ? (
        <section
          className="evidence-group evidence-group--blockers"
          aria-labelledby="blocker-title"
        >
          <h3 id="blocker-title">
            {t(candidate.state === 'edited' ? 'Original inference blockers' : 'Blockers')}
          </h3>
          <ul>
            {candidate.blockers.map((blocker) => (
              <li key={`${blocker.code}:${blocker.summary}`}>
                <strong>{blocker.code}</strong>
                <span>{localize(blocker.summary)}</span>
                {blocker.sourcePointers.length > 0 ? (
                  <ul
                    className="source-pointer-list"
                    aria-label={t('{{code}} sources', { code: blocker.code })}
                  >
                    {blocker.sourcePointers.map((pointer) => (
                      <li key={pointer}>
                        <code>{pointer}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map((kind) => {
        const evidence = groups[kind]
        if (evidence.length === 0) return null

        return (
          <section className="evidence-group" key={kind} aria-labelledby={`evidence-${kind}`}>
            <h3 id={`evidence-${kind}`}>{t(GROUP_LABELS[kind])}</h3>
            <ul>
              {evidence.map((item) => (
                <li key={`${item.ruleId}:${item.summary}`}>
                  <div className="evidence-rule">
                    <strong>{item.ruleId}</strong>
                    <span className="evidence-weight">
                      {item.weight > 0 ? '+' : ''}
                      {item.weight}
                    </span>
                  </div>
                  <p>{localize(item.summary)}</p>
                  {item.sourcePointers.length > 0 ? (
                    <ul
                      className="source-pointer-list"
                      aria-label={t('{{code}} sources', { code: item.ruleId })}
                    >
                      {item.sourcePointers.map((pointer) => (
                        <li key={pointer}>
                          <code>{pointer}</code>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {'schemaWarnings' in candidate && candidate.schemaWarnings.length > 0 ? (
        <section
          className="evidence-group evidence-group--warnings"
          aria-labelledby="schema-warning-title"
        >
          <h3 id="schema-warning-title">{t('Schema warnings')}</h3>
          <ul>
            {candidate.schemaWarnings.map((warning) => (
              <li key={warning}>{localize(warning)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {'sourcePointers' in candidate && candidate.sourcePointers.length > 0 ? (
        <details className="evidence-inspector__sources">
          <summary>{t('Mapping source pointers')}</summary>
          <ul className="source-pointer-list">
            {candidate.sourcePointers.map((pointer) => (
              <li key={pointer}>
                <code>{pointer}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <details className="evidence-inspector__identity">
        <summary>{t('Candidate identity')}</summary>
        <dl>
          <div>
            <dt>{t('Candidate ID')}</dt>
            <dd>
              <code>{candidate.id}</code>
            </dd>
          </div>
          <div>
            <dt>{t('Fingerprint')}</dt>
            <dd>
              <code>{candidate.fingerprint}</code>
            </dd>
          </div>
        </dl>
      </details>
    </aside>
  )
}
