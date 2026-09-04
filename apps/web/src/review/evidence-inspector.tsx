import { groupReviewEvidence, type ReviewCandidateDetail } from './review-detail'
import type { ProjectedReviewCandidateDetail } from './review-workspace-adapter'

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
  if (!candidate || !open) {
    return null
  }

  const groups = groupReviewEvidence(candidate)

  return (
    <aside className="evidence-inspector" aria-labelledby="evidence-title">
      <header className="evidence-inspector__header">
        <div>
          <p className="section-label">Inference evidence</p>
          <h2 id="evidence-title">Why this mapping was suggested</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close evidence">
          ×
        </button>
      </header>

      <dl className="evidence-inspector__summary">
        <div>
          <dt>Confidence</dt>
          <dd>
            {candidate.band} · {Math.round(candidate.confidence * 100)}%
          </dd>
        </div>
        <div>
          <dt>Rule set</dt>
          <dd>{candidate.ruleSetVersion}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{candidate.state}</dd>
        </div>
      </dl>

      <p className="evidence-inspector__notice">
        This inference is a candidate, not an authoritative workflow fact.
      </p>

      {candidate.blockers.length > 0 ? (
        <section
          className="evidence-group evidence-group--blockers"
          aria-labelledby="blocker-title"
        >
          <h3 id="blocker-title">Blockers</h3>
          <ul>
            {candidate.blockers.map((blocker) => (
              <li key={`${blocker.code}:${blocker.summary}`}>
                <strong>{blocker.code}</strong>
                <span>{blocker.summary}</span>
                {blocker.sourcePointers.length > 0 ? (
                  <ul className="source-pointer-list" aria-label={`${blocker.code} sources`}>
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
            <h3 id={`evidence-${kind}`}>{GROUP_LABELS[kind]}</h3>
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
                  <p>{item.summary}</p>
                  {item.sourcePointers.length > 0 ? (
                    <ul className="source-pointer-list" aria-label={`${item.ruleId} sources`}>
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
          <h3 id="schema-warning-title">Schema warnings</h3>
          <ul>
            {candidate.schemaWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {'sourcePointers' in candidate && candidate.sourcePointers.length > 0 ? (
        <details className="evidence-inspector__sources">
          <summary>Mapping source pointers</summary>
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
        <summary>Candidate identity</summary>
        <dl>
          <div>
            <dt>Candidate ID</dt>
            <dd>
              <code>{candidate.id}</code>
            </dd>
          </div>
          <div>
            <dt>Fingerprint</dt>
            <dd>
              <code>{candidate.fingerprint}</code>
            </dd>
          </div>
        </dl>
      </details>
    </aside>
  )
}
