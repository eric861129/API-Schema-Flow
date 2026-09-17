import type { RefObject } from 'react'

import type {
  ReviewCandidateSort,
  ReviewCandidateStateFilter,
  ReviewConfidenceBand,
  ReviewSessionFilters,
} from './review-session'
import { useI18n } from '../i18n'

export interface ReviewFiltersProps {
  readonly filters: ReviewSessionFilters
  readonly sort: ReviewCandidateSort
  readonly visibleCount: number
  readonly totalCount: number
  readonly empty: boolean
  readonly searchInputRef: RefObject<HTMLInputElement | null>
  readonly onQueryChange: (query: string) => void
  readonly onToggleConfidence: (band: ReviewConfidenceBand) => void
  readonly onReviewStateChange: (state: ReviewCandidateStateFilter) => void
  readonly onBlockersOnlyChange: (enabled: boolean) => void
  readonly onSortChange: (sort: ReviewCandidateSort) => void
  readonly onReset: () => void
}

const CONFIDENCE_OPTIONS: readonly {
  readonly band: ReviewConfidenceBand
  readonly label: string
}[] = [
  { band: 'high', label: 'High' },
  { band: 'medium', label: 'Medium' },
  { band: 'low', label: 'Low' },
  { band: 'hidden', label: 'Hidden' },
]

export function ReviewFilters({
  filters,
  sort,
  visibleCount,
  totalCount,
  empty,
  searchInputRef,
  onQueryChange,
  onToggleConfidence,
  onReviewStateChange,
  onBlockersOnlyChange,
  onSortChange,
  onReset,
}: ReviewFiltersProps) {
  const { status, t } = useI18n()
  const reviewStateLabel = (state: ReviewCandidateStateFilter) =>
    status(
      state === 'needs-attention' ? 'Needs attention' : state[0]?.toUpperCase() + state.slice(1),
    )
  return (
    <div className="review-filters" aria-label={t('Review candidate filters')}>
      <label className="review-search-field">
        <span>{t('Search')}</span>
        <input
          ref={searchInputRef}
          type="search"
          value={filters.query}
          aria-label={t('Search review candidates')}
          placeholder={t('Path, operation, selector…')}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
      </label>

      <div className="review-filter-group" aria-label={t('Confidence filters')}>
        <span className="review-filter-group__label">{t('Confidence')}</span>
        <div className="review-filter-pills">
          {CONFIDENCE_OPTIONS.map(({ band, label }) => (
            <button
              key={band}
              type="button"
              className="review-filter-pill"
              aria-label={t(`${label} confidence`)}
              aria-pressed={filters.confidenceBands.includes(band)}
              onClick={() => onToggleConfidence(band)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      <label className="review-select-field">
        <span>{t('Review state')}</span>
        <select
          aria-label={t('Review state')}
          value={filters.reviewState}
          onChange={(event) =>
            onReviewStateChange(event.currentTarget.value as ReviewCandidateStateFilter)
          }
        >
          <option value="pending">{reviewStateLabel('pending')}</option>
          <option value="accepted">{reviewStateLabel('accepted')}</option>
          <option value="rejected">{reviewStateLabel('rejected')}</option>
          <option value="edited">{reviewStateLabel('edited')}</option>
          <option value="needs-attention">{reviewStateLabel('needs-attention')}</option>
          <option value="all">{reviewStateLabel('all')}</option>
        </select>
      </label>

      <label className="review-checkbox-field">
        <input
          type="checkbox"
          checked={filters.hasBlockersOnly}
          aria-label={t('Has blockers only')}
          onChange={(event) => onBlockersOnlyChange(event.currentTarget.checked)}
        />
        <span>{t('Has blockers only')}</span>
      </label>

      <label className="review-select-field">
        <span>{t('Sort')}</span>
        <select
          aria-label={t('Sort candidates')}
          value={sort}
          onChange={(event) => onSortChange(event.currentTarget.value as ReviewCandidateSort)}
        >
          <option value="confidence-desc">{t('Confidence')}</option>
          <option value="source-endpoint">{t('Source endpoint')}</option>
          <option value="target-endpoint">{t('Target endpoint')}</option>
          <option value="review-state">{t('Review state')}</option>
        </select>
      </label>

      <div className="review-filter-status">
        <span>
          {t('{{visible}} of {{total}} candidates', { visible: visibleCount, total: totalCount })}
        </span>
        <button type="button" className="text-button" onClick={onReset}>
          {t('Reset filters')}
        </button>
      </div>

      {empty && totalCount > 0 ? (
        <div className="review-filter-empty" role="status">
          <span>{t('No candidates match the current review filters.')}</span>
          <button
            type="button"
            className="secondary-button"
            onClick={onReset}
            aria-label={t('Reset review filters')}
          >
            {t('Reset review filters')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
