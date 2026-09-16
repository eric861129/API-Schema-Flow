/** 顯示未儲存狀態；只有操作結果使用即時播報。 */
export function ReviewStatusBar({
  draftCount,
  edgeCount,
  selectedId,
  announcement,
  onUndo,
}: {
  readonly draftCount: number
  readonly edgeCount: number
  readonly selectedId: string | null
  readonly announcement: string
  readonly onUndo: () => void
}) {
  const relationshipLabel = `${edgeCount} accepted relationship${edgeCount === 1 ? '' : 's'}`

  return (
    <footer className="review-status-bar" role="region" aria-label="Review status">
      <strong>
        {draftCount === 0
          ? 'No draft changes'
          : `${draftCount} unsaved review change${draftCount === 1 ? '' : 's'}`}
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
      <span className="review-status-selection">
        {selectedId ? `Selected ${selectedId}` : 'No candidate selected'}
      </span>
      <p className="review-status-warning">
        Refreshing this page discards the current review changes.
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
