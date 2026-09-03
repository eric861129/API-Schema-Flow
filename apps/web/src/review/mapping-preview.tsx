import { describeReviewCompatibility, type ReviewCandidateDetail } from './review-detail'

export interface MappingPreviewProps {
  readonly candidate: ReviewCandidateDetail | null
}

function schemaLabel(schema: ReviewCandidateDetail['sourceSchema']): string {
  const parts = [schema.type, schema.format].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Schema type unknown'
}

export function MappingPreview({ candidate }: MappingPreviewProps) {
  if (!candidate) {
    return (
      <section className="mapping-preview mapping-preview--empty" aria-labelledby="mapping-title">
        <div>
          <p className="section-label">Mapping preview</p>
          <h2 id="mapping-title">Select an inference candidate</h2>
          <p>Choose a candidate to inspect its source, target, compatibility, and evidence.</p>
        </div>
      </section>
    )
  }

  const compatibility = describeReviewCompatibility(candidate)

  return (
    <section className="mapping-preview" aria-labelledby="mapping-title">
      <header className="mapping-preview__header">
        <div>
          <p className="section-label">Mapping preview</p>
          <h2 id="mapping-title">Review inferred data transfer</h2>
        </div>
        <span className="mapping-preview__confidence">
          {candidate.band} · {Math.round(candidate.confidence * 100)}%
        </span>
      </header>

      <div className="mapping-preview__flow" aria-label="Source to target mapping">
        <article className="mapping-endpoint mapping-endpoint--source">
          <p className="mapping-endpoint__role">Source response</p>
          <h3>{candidate.sourceLabel}</h3>
          <code>{candidate.sourceSelector}</code>
          <p>{schemaLabel(candidate.sourceSchema)}</p>
        </article>

        <div className="mapping-transfer" aria-hidden="true">
          <span>Data transfer</span>
          <span className="mapping-transfer__line">→</span>
        </div>

        <article className="mapping-endpoint mapping-endpoint--target">
          <p className="mapping-endpoint__role">Target request</p>
          <h3>{candidate.targetLabel}</h3>
          <code>{candidate.targetDescriptor}</code>
          <p>
            {schemaLabel(candidate.targetSchema)}
            {candidate.targetSchema.required ? ' · required' : ''}
          </p>
        </article>
      </div>

      {candidate.alias || candidate.transform ? (
        <dl className="mapping-preview__metadata">
          {candidate.alias ? (
            <div>
              <dt>Alias</dt>
              <dd>{candidate.alias}</dd>
            </div>
          ) : null}
          {candidate.transform ? (
            <div>
              <dt>Transform</dt>
              <dd>{candidate.transform}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mapping-preview__compatibility">
        <h3>Compatibility</h3>
        <ul>
          {compatibility.map((item) => (
            <li key={`${item.state}:${item.label}`} data-state={item.state}>
              <span aria-hidden="true">
                {item.state === 'compatible'
                  ? '✓'
                  : item.state === 'blocked'
                    ? '×'
                    : item.state === 'warning'
                      ? '⚠'
                      : '•'}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="mapping-preview__notice">
        This is an inference candidate, not an authoritative workflow relationship, until it is
        reviewed.
      </p>
    </section>
  )
}
