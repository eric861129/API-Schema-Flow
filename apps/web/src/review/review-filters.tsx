import type { RefObject } from 'react'

import type {
  ReviewCandidateSort,
  ReviewCandidateStateFilter,
  ReviewConfidenceBand,
  ReviewSessionFilters,
} from './review-session'

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
  return (
    <div className="review-filters" aria-label="Review candidate filters">
      <label className="review-search-field">
        <span>Search</span>
        <input
          ref={searchInputRef}
          type="search"
          value={filters.query}
          aria-label="Search review candidates"
          placeholder="Path, operation, selector…"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
      </label>

      <div className="review-filter-group" aria-label="Confidence filters">
        <span className="review-filter-group__label">Confidence</span>
        <div className="review-filter-pills">
          {CONFIDENCE_OPTIONS.map(({ band, label }) => (
            <button
              key={band}
              type="button"
              className="review-filter-pill"
              aria-label={`${label} confidence`}
              aria-pressed={filters.confidenceBands.includes(band)}
              onClick={() => onToggleConfidence(band)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="review-select-field">
        <span>Review state</span>
        <select
          aria-label="Review state"
          value={filters.reviewState}
          onChange={(event) =>
            onReviewStateChange(event.currentTarget.value as ReviewCandidateStateFilter)
          }
        >
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="edited">Edited</option>
          <option value="needs-attention">Needs attention</option>
          <option value="all">All</option>
        </select>
      </label>

      <label className="review-checkbox-field">
        <input
          type="checkbox"
          checked={filters.hasBlockersOnly}
          aria-label="Has blockers only"
          onChange={(event) => onBlockersOnlyChange(event.currentTarget.checked)}
        />
        <span>Has blockers only</span>
      </label>

      <label className="review-select-field">
        <span>Sort</span>
        <select
          aria-label="Sort candidates"
          value={sort}
          onChange={(event) => onSortChange(event.currentTarget.value as ReviewCandidateSort)}
        >
          <option value="confidence-desc">Confidence</option>
          <option value="source-endpoint">Source endpoint</option>
          <option value="target-endpoint">Target endpoint</option>
          <option value="review-state">Review state</option>
        </select>
      </label>

      <div className="review-filter-status">
        <span>
          {visibleCount} of {totalCount} candidates
        </span>
        <button type="button" className="text-button" onClick={onReset}>
          Reset filters
        </button>
      </div>

      {empty && totalCount > 0 ? (
        <div className="review-filter-empty" role="status">
          <span>No candidates match the current review filters.</span>
          <button
            type="button"
            className="secondary-button"
            onClick={onReset}
            aria-label="Reset review filters"
          >
            Reset review filters
          </button>
        </div>
      ) : null}
    </div>
  )
}
