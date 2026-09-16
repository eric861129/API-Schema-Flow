import type { ProjectedReviewCandidateDetail } from './review-workspace-adapter'

/** 所選候選的審核操作，決策語意由 Review core 判定。 */
export function ReviewActions({
  candidate,
  onAccept,
  onReject,
}: {
  readonly candidate: ProjectedReviewCandidateDetail | null
  readonly onAccept: () => void
  readonly onReject: () => void
}) {
  if (!candidate)
    return (
      <p className="review-empty-copy">
        Review actions become available after a candidate is selected.
      </p>
    )

  const acceptUnavailable =
    candidate.blockerCount > 0 || !['pending', 'rejected'].includes(candidate.state)
  return (
    <div className="review-decision-controls">
      <p className="review-decision-state">Review state: {candidate.state}</p>
      {candidate.outcomeReason ? <p>{candidate.outcomeReason}</p> : null}
      {candidate.blockers.length > 0 ? (
        <ul>
          {candidate.blockers.map((blocker, index) => (
            <li key={`${blocker.code}:${index}`}>{blocker.summary}</li>
          ))}
        </ul>
      ) : null}
      <div className="review-action-buttons">
        <button
          type="button"
          className="review-action-button review-action-button--accept"
          disabled={acceptUnavailable}
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          type="button"
          className="review-action-button review-action-button--reject"
          disabled={candidate.state === 'rejected'}
          onClick={onReject}
        >
          Reject
        </button>
      </div>
    </div>
  )
}
