import { useEffect, useRef, useState } from 'react'
import type { ReviewDecisionSet } from '@api-schema-flow/domain'
import { useReviewSession } from './review-session-context'
import {
  MAX_DECISION_FILE_BYTES,
  parseDecisionFile,
  previewDecisionImport,
  serializeDecisionSet,
  encodeStoredReview,
  initialStoredSession,
} from './review-transfer'
import { readStoredReview, resetStoredReview } from './review-storage'

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ImportPreview({
  incoming,
  onClose,
}: {
  readonly incoming: ReviewDecisionSet
  readonly onClose: () => void
}) {
  const { snapshot, state, dispatch } = useReviewSession()
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = previewDecisionImport(snapshot, state, incoming)
  const counts = new Map<string, number>()
  for (const outcome of preview.materialization.result.outcomes)
    counts.set(outcome.state, (counts.get(outcome.state) ?? 0) + 1)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current!
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="mapping-editor"
      aria-label="Import Decision Set preview"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll('button')]
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          event.preventDefault()
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus()
        }
      }}
    >
      <h2>Import Decision Set</h2>
      <p>
        {incoming.decisions.length} decisions and {incoming.manualEdges.length} manual edges in this
        file.
      </p>
      <p>Result after merging with current decisions:</p>
      <ul>
        {[...counts].map(([name, count]) => (
          <li key={name}>
            {name}: {count}
          </li>
        ))}
      </ul>
      <p>
        {preview.materialization.result.graph.edges.length} accepted relationships. Stale, orphaned,
        invalid and conflicting decisions do not create accepted edges.
      </p>
      <ul>
        {preview.materialization.result.diagnostics.map((item, index) => (
          <li key={index}>{item.message}</li>
        ))}
      </ul>
      <button type="button" onClick={onClose}>
        Cancel import
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: 'restore-decisions',
            draftIntents: preview.state.draftIntents,
            importedDecisionSet: preview.state.importedDecisionSet,
            baselineRevisions: preview.state.baselineRevisions,
          })
          onClose()
        }}
      >
        Apply import
      </button>
    </dialog>
  )
}

export function ReviewTransferControls() {
  const { snapshot, state, materialization, persistence } = useReviewSession()
  const input = useRef<HTMLInputElement>(null)
  const [incoming, setIncoming] = useState<ReviewDecisionSet | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function importFile(file: File) {
    setError('')
    setBusy(true)
    try {
      if (file.size > MAX_DECISION_FILE_BYTES)
        throw new Error('Decision Set exceeds the 5 MB limit.')
      const parsed = parseDecisionFile(await file.text())
      previewDecisionImport(snapshot, state, parsed)
      setIncoming(parsed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cannot import this file.')
    } finally {
      setBusy(false)
    }
  }
  async function recover(reset: boolean) {
    setBusy(true)
    setError('')
    try {
      const stored = await readStoredReview(persistence.key)
      if (!reset) download('review-storage-backup.json', JSON.stringify(stored ?? null, null, 2))
      else if (
        window.confirm(
          'Reset saved decisions for this project and source version? Export a backup first.',
        )
      ) {
        await resetStoredReview(
          persistence.key,
          stored?.generation ?? 0,
          encodeStoredReview(snapshot, initialStoredSession(snapshot)),
        )
        persistence.reloadSaved()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cannot access local storage.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="review-transfer-controls">
      <button
        type="button"
        className="secondary-button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Import Decision Set
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Decision Set file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importFile(file)
        }}
      />
      <button
        type="button"
        className="secondary-button"
        onClick={() =>
          download('review-decisions.json', serializeDecisionSet(materialization.decisionSet))
        }
      >
        Export Decision Set
      </button>
      {persistence.error ? (
        <>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={persistence.reloadSaved}
          >
            Reload saved data
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void recover(false)}
          >
            Back up stored data
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void recover(true)}
          >
            Reset saved data
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {incoming ? <ImportPreview incoming={incoming} onClose={() => setIncoming(null)} /> : null}
    </div>
  )
}
