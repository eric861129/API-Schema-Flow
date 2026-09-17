import { useMemo, useRef, type KeyboardEvent } from 'react'

import type { ReviewCandidateRow } from './review-selectors'
import { useI18n } from '../i18n'

export interface CandidateListProps {
  readonly candidates: readonly ReviewCandidateRow[]
  readonly selectedCandidateId: string | null
  readonly onSelect: (candidateId: string) => void
  readonly emptyMessage?: string
}

export function CandidateList({
  candidates,
  selectedCandidateId,
  onSelect,
  emptyMessage = 'No candidates match the current review filters.',
}: CandidateListProps) {
  const { status, t } = useI18n()
  const confidenceLabel = (candidate: ReviewCandidateRow) =>
    `${status(candidate.band)} · ${Math.round(candidate.confidence * 100)}%`
  const candidateAccessibleLabel = (candidate: ReviewCandidateRow) =>
    t(
      'Source {{source}} {{sourceSelector}}; target {{target}} {{targetDescriptor}}; {{confidence}}; {{state}}; {{evidence}} evidence; {{blockers}}',
      {
        source: candidate.sourceLabel,
        sourceSelector: candidate.sourceSelector,
        target: candidate.targetLabel,
        targetDescriptor: candidate.targetDescriptor,
        confidence: confidenceLabel(candidate),
        state: status(candidate.state),
        evidence: String(candidate.evidenceCount),
        blockers:
          candidate.blockerCount > 0
            ? t(candidate.blockerCount === 1 ? '{{count}} blocker' : '{{count}} blockers', {
                count: candidate.blockerCount,
              })
            : '',
      },
    )
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
        <strong>{t('No review candidates')}</strong>
        <span>{t(emptyMessage)}</span>
      </div>
    )
  }

  return (
    <div
      className="candidate-list"
      role="listbox"
      aria-label={t('Inference candidates, {{count}} visible', { count: candidates.length })}
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
                {status(candidate.state)}
              </span>
              <span>{t('{{count}} evidence', { count: candidate.evidenceCount })}</span>
              {candidate.blockerCount > 0 ? (
                <span className="blocker-count">
                  ⚠ {t('{{count}} blockers', { count: candidate.blockerCount })}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
