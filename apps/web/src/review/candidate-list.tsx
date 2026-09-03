import { useMemo, useRef, type KeyboardEvent } from 'react'

import type { ReviewCandidateRow } from './review-selectors'

export interface CandidateListProps {
  readonly candidates: readonly ReviewCandidateRow[]
  readonly selectedCandidateId: string | null
  readonly onSelect: (candidateId: string) => void
  readonly emptyMessage?: string
}

const STATE_LABELS: Readonly<Record<ReviewCandidateRow['state'], string>> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  edited: 'Manual accepted',
  stale: 'Stale',
  orphaned: 'Orphaned',
  superseded: 'Superseded',
  conflict: 'Conflict',
  invalid: 'Invalid',
}

function confidenceLabel(candidate: ReviewCandidateRow): string {
  return `${candidate.band[0]?.toUpperCase()}${candidate.band.slice(1)} · ${Math.round(candidate.confidence * 100)}%`
}

function candidateAccessibleLabel(candidate: ReviewCandidateRow): string {
  const blockers =
    candidate.blockerCount > 0
      ? `; ${candidate.blockerCount} blocker${candidate.blockerCount === 1 ? '' : 's'}`
      : ''

  return `Source ${candidate.sourceLabel} ${candidate.sourceSelector}; target ${candidate.targetLabel} ${candidate.targetDescriptor}; ${confidenceLabel(candidate)}; ${STATE_LABELS[candidate.state]}; ${candidate.evidenceCount} evidence${blockers}`
}

export function CandidateList({
  candidates,
  selectedCandidateId,
  onSelect,
  emptyMessage = 'No candidates match the current review filters.',
}: CandidateListProps) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())
  const candidateIds = useMemo(() => candidates.map(({ id }) => id), [candidates])

  function focusCandidate(index: number) {
    const id = candidateIds[index]
    if (id) {
      buttonRefs.current.get(id)?.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusCandidate(Math.min(index + 1, candidateIds.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        focusCandidate(Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        focusCandidate(0)
        break
      case 'End':
        event.preventDefault()
        focusCandidate(candidateIds.length - 1)
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const candidateId = candidateIds[index]
        if (candidateId) onSelect(candidateId)
        break
      }
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="review-empty-state" role="status">
        <strong>No review candidates</strong>
        <span>{emptyMessage}</span>
      </div>
    )
  }

  return (
    <div
      className="candidate-list"
      role="listbox"
      aria-label={`Inference candidates, ${candidates.length} visible`}
    >
      {candidates.map((candidate, index) => {
        const selected = candidate.id === selectedCandidateId

        return (
          <button
            key={candidate.id}
            ref={(element) => {
              if (element) buttonRefs.current.set(candidate.id, element)
              else buttonRefs.current.delete(candidate.id)
            }}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={candidateAccessibleLabel(candidate)}
            className="candidate-row"
            data-state={candidate.state}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onSelect(candidate.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className="candidate-row__route">{candidate.sourceLabel}</span>
            <span className="candidate-row__selector">{candidate.sourceSelector}</span>
            <span className="candidate-row__arrow" aria-hidden="true">
              ↓
            </span>
            <span className="candidate-row__route">{candidate.targetLabel}</span>
            <span className="candidate-row__selector">{candidate.targetDescriptor}</span>
            <span className="candidate-row__meta">
              <span className="confidence-badge" data-band={candidate.band}>
                {confidenceLabel(candidate)}
              </span>
              <span className="review-state-badge" data-state={candidate.state}>
                {STATE_LABELS[candidate.state]}
              </span>
              <span>{candidate.evidenceCount} evidence</span>
              {candidate.blockerCount > 0 ? (
                <span className="blocker-count">⚠ {candidate.blockerCount} blockers</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
