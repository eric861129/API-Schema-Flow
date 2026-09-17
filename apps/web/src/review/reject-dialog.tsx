import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { validateRejectReason, type ReviewRejectReason } from './review-session'
import { useI18n } from '../i18n'

const REJECT_REASONS: readonly { value: ReviewRejectReason; label: string }[] = [
  { value: 'wrong-resource', label: 'Wrong resource' },
  { value: 'wrong-field', label: 'Wrong field' },
  { value: 'not-a-workflow', label: 'Not a workflow' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'unsafe-or-ambiguous', label: 'Unsafe or ambiguous' },
  { value: 'other', label: 'Other' },
]

/** 對話框保留結構化原因，並隔離背景互動與鍵盤焦點。 */
export function RejectDialog({
  candidateLabel,
  onCancel,
  onConfirm,
}: {
  readonly candidateLabel: string
  readonly onCancel: () => void
  readonly onConfirm: (reason: ReviewRejectReason, note?: string) => void
}) {
  const { localize, t } = useI18n()
  const titleId = useId()
  const errorId = useId()
  const backdropRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [reason, setReason] = useState<ReviewRejectReason | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const previousFocus = document.activeElement
    const siblings = [...document.body.children]
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== backdropRef.current,
      )
      .map((element) => ({
        element,
        inert: element.inert,
        hidden: element.getAttribute('aria-hidden'),
      }))
    for (const { element } of siblings) {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    }
    formRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      for (const { element, inert, hidden } of siblings) {
        element.inert = inert
        if (hidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', hidden)
      }
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    // 不讓工作台的搜尋與 Escape 快捷鍵穿透對話框。
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
    if (event.key !== 'Tab') return
    const elements = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('input, textarea, button'),
    ]
    const radios = elements.filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.type === 'radio',
    )
    const activeRadio = radios.find((radio) => radio.checked) ?? radios[0]
    const focusable = elements.filter(
      (element) => !radios.includes(element as HTMLInputElement) || element === activeRadio,
    )
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return createPortal(
    <div ref={backdropRef} className="review-dialog-backdrop">
      <form
        ref={formRef}
        className="review-reject-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onSubmit={(event) => {
          event.preventDefault()
          if (!reason) {
            setError(t('Choose a reject reason.'))
            return
          }
          const validation = validateRejectReason(reason, note)
          if (!validation.valid) {
            setError(localize(validation.message))
            return
          }
          onConfirm(reason, note.trim() || undefined)
        }}
      >
        <h2 id={titleId}>{t('Reject candidate')}</h2>
        <p>{candidateLabel}</p>
        <fieldset aria-describedby={error ? errorId : undefined}>
          <legend>{t('Reason (required)')}</legend>
          {REJECT_REASONS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name={titleId}
                value={option.value}
                checked={reason === option.value}
                onChange={() => {
                  setReason(option.value)
                  setError('')
                }}
              />
              {t(option.label)}
            </label>
          ))}
        </fieldset>
        <label className="review-note-field">
          {t(reason === 'other' ? 'Note (required for Other)' : 'Note (optional)')}
          <textarea
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            aria-required={reason === 'other'}
            aria-invalid={reason === 'other' && Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        {error ? (
          <p id={errorId} role="alert">
            {localize(error)}
          </p>
        ) : null}
        <div className="review-dialog-buttons">
          <button type="button" onClick={onCancel}>
            {t('Cancel')}
          </button>
          <button type="submit">{t('Confirm rejection')}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
