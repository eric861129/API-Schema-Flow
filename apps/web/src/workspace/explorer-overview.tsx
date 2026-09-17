import { useTranslation } from 'react-i18next'

import type { ReviewCandidateRow } from '../review/review-selectors'

export function ExplorerOverview({
  operations,
  groups,
  accepted,
  candidates,
  onReview,
  onOpenReview,
}: {
  readonly operations: number
  readonly groups: number
  readonly accepted: number
  readonly candidates: readonly ReviewCandidateRow[]
  readonly onReview: (id: string) => void
  readonly onOpenReview: () => void
}) {
  const { t } = useTranslation()
  let pendingCount = 0
  let best: ReviewCandidateRow | undefined
  for (const candidate of candidates) {
    if (candidate.state !== 'pending') continue
    pendingCount += 1
    if (
      !best ||
      candidate.blockerCount < best.blockerCount ||
      (candidate.blockerCount === best.blockerCount && candidate.confidence > best.confidence) ||
      (candidate.blockerCount === best.blockerCount &&
        candidate.confidence === best.confidence &&
        candidate.evidenceCount > best.evidenceCount) ||
      (candidate.blockerCount === best.blockerCount &&
        candidate.confidence === best.confidence &&
        candidate.evidenceCount === best.evidenceCount &&
        candidate.id.localeCompare(best.id) < 0)
    )
      best = candidate
  }

  return (
    <section className="explorer-overview" aria-label={t('Explore API tasks')}>
      <div className="explorer-overview__summary">
        <span className="eyebrow">{t('API OVERVIEW')}</span>
        <strong>{t('Find a data handoff')}</strong>
        <span>
          {t(
            '{{operations}} endpoints · {{groups}} groups · {{accepted}} confirmed · {{pending}} suggestions',
            {
              operations,
              groups,
              accepted,
              pending: pendingCount,
            },
          )}
        </span>
      </div>
      <div className="explorer-overview__suggestions">
        {best ? (
          <>
            <button type="button" onClick={() => onReview(best.id)}>
              <span>
                {best.sourceLabel} → {best.targetLabel}
              </span>
              <small>
                {best.sourceSelector} → {best.targetDescriptor}
              </small>
            </button>
            <button type="button" onClick={onOpenReview}>
              <span>{t('Review all suggestions')}</span>
              <small>
                {t('{{count}} pending mappings with evidence', { count: pendingCount })}
              </small>
            </button>
          </>
        ) : (
          <p>{t('Select an endpoint to inspect its data and confirmed relationships.')}</p>
        )}
      </div>
    </section>
  )
}
