import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

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
  const { localize, t } = useI18n()
  const relationshipLabel = t(
    edgeCount === 1 ? '{{count}} accepted relationship' : '{{count}} accepted relationships',
    { count: edgeCount },
  )

  return (
    <section className="review-status-bar" aria-label={t('Review status')}>
      <strong>
        {draftCount === 0
          ? t('No draft changes')
          : t(draftCount === 1 ? '{{count}} review change' : '{{count}} review changes', {
              count: draftCount,
            })}
      </strong>
      <button
        type="button"
        className="review-action-button"
        disabled={draftCount === 0}
        onClick={onUndo}
      >
        {t('Undo latest change')}
      </button>
      <span>{relationshipLabel}</span>
      {children}
      <span className="sr-only">
        {selectedId ? t('Selected {{id}}', { id: selectedId }) : t('No candidate selected')}
      </span>
      <p
        className="review-status-warning"
        role={storageError ? 'alert' : 'status'}
        aria-label={t('Local storage status')}
      >
        {localize(storageStatus)}
      </p>
      <p
        className="sr-only"
        role="status"
        aria-label={t('Review announcement')}
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
    </section>
  )
}
