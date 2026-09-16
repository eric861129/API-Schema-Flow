import type { ReviewCandidateRow } from './review-selectors'

export interface ReviewSummaryTableProps {
  readonly candidates: readonly ReviewCandidateRow[]
  readonly selectedCandidateId: string | null
  readonly onSelect: (candidateId: string) => void
}

const STATE_LABELS: Readonly<Record<ReviewCandidateRow['state'], string>> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  edited: 'Edited',
  stale: 'Stale',
  orphaned: 'Orphaned',
  superseded: 'Superseded',
  conflict: 'Conflict',
  invalid: 'Invalid',
}

function confidenceLabel(candidate: ReviewCandidateRow): string {
  return `${candidate.band[0]?.toUpperCase()}${candidate.band.slice(1)} · ${Math.round(candidate.confidence * 100)}%`
}

export function ReviewSummaryTable({
  candidates,
  selectedCandidateId,
  onSelect,
}: ReviewSummaryTableProps) {
  if (candidates.length === 0) {
    return <p className="review-empty-copy">No visible candidates to summarize.</p>
  }

  return (
    <div className="review-summary-table-wrap">
      <table className="review-summary-table" aria-label="Review candidate summary">
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Target</th>
            <th scope="col">Confidence</th>
            <th scope="col">State</th>
            <th scope="col">Evidence</th>
            <th scope="col">Blockers</th>
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
                <td>{STATE_LABELS[candidate.state]}</td>
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
