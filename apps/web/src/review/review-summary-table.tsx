import type { ReviewCandidateRow } from './review-selectors'
import { useI18n } from '../i18n'

export interface ReviewSummaryTableProps {
  readonly candidates: readonly ReviewCandidateRow[]
  readonly selectedCandidateId: string | null
  readonly onSelect: (candidateId: string) => void
}

export function ReviewSummaryTable({
  candidates,
  selectedCandidateId,
  onSelect,
}: ReviewSummaryTableProps) {
  const { status, t } = useI18n()
  const confidenceLabel = (candidate: ReviewCandidateRow) =>
    `${status(candidate.band)} · ${Math.round(candidate.confidence * 100)}%`
  if (candidates.length === 0) {
    return <p className="review-empty-copy">{t('No visible candidates to summarize.')}</p>
  }

  return (
    <div className="review-summary-table-wrap">
      <table className="review-summary-table" aria-label={t('Review candidate summary')}>
        <thead>
          <tr>
            <th scope="col">{t('Source')}</th>
            <th scope="col">{t('Target')}</th>
            <th scope="col">{t('Confidence')}</th>
            <th scope="col">{t('State')}</th>
            <th scope="col">{t('Evidence')}</th>
            <th scope="col">{t('Blockers')}</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const selected = candidate.id === selectedCandidateId
            return (
              <tr key={candidate.id} data-selected={selected ? 'true' : 'false'}>
                <td>
                  <button
                    type="button"
                    className="review-summary-link"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(candidate.id)}
                  >
                    {candidate.sourceLabel}
                  </button>
                  <code>{candidate.sourceSelector}</code>
                </td>
                <td>
                  <span>{candidate.targetLabel}</span>
                  <code>{candidate.targetDescriptor}</code>
                </td>
                <td>{confidenceLabel(candidate)}</td>
                <td>{status(candidate.state)}</td>
                <td>{candidate.evidenceCount}</td>
                <td>{candidate.blockerCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
