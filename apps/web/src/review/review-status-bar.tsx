import type { ReactNode } from 'react'

/** 儲存狀態以交易完成為準，操作結果另以即時區域播報。 */
export function ReviewStatusBar({
  draftCount,
  edgeCount,
  selectedId,
  announcement,
  onUndo,
  storageStatus = 'Local storage unavailable. Export decisions before closing.',
  storageError = false,
  children,
}: {
  readonly draftCount: number
  readonly edgeCount: number
  readonly selectedId: string | null
  readonly announcement: string
  readonly onUndo: () => void
  readonly storageStatus?: string
  readonly storageError?: boolean
  readonly children?: ReactNode
}) {
  const relationshipLabel = `${edgeCount} accepted relationship${edgeCount === 1 ? '' : 's'}`

  return (
    <footer className="review-status-bar" role="region" aria-label="Review status">
      <strong>
        {draftCount === 0
          ? 'No draft changes'
          : `${draftCount} review change${draftCount === 1 ? '' : 's'}`}
      </strong>
      <button
        type="button"
        className="review-action-button"
        disabled={draftCount === 0}
        onClick={onUndo}
      >
        Undo latest change
      </button>
      <span>{relationshipLabel}</span>
      {children}
      <span className="sr-only">
        {selectedId ? `Selected ${selectedId}` : 'No candidate selected'}
      </span>
      <p
        className="review-status-warning"
        role={storageError ? 'alert' : 'status'}
        aria-label="Local storage status"
      >
        {storageStatus}
      </p>
      <p
        className="sr-only"
        role="status"
        aria-label="Review announcement"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
    </footer>
  )
}
