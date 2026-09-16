import { useEffect, useRef, useState } from 'react'
import { useReviewSession } from '../review/review-session-context'
import type { ReviewSessionState } from '../review/review-session'
import { MAX_DECISION_FILE_BYTES } from '../review/review-transfer'
import { DEFAULT_WORKSPACE_LAYOUT } from './workspace-layout'
import { parseProject, serializeProject } from './project-file'

function ProjectDialog({ onClose }: { readonly onClose: () => void }) {
  const { snapshot, state, dispatch, persistence } = useReviewSession()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [incoming, setIncoming] = useState<ReviewSessionState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current!
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  async function load(file: File) {
    setBusy(true)
    setError('')
    setIncoming(null)
    try {
      if (file.size > MAX_DECISION_FILE_BYTES)
        throw new Error('Project file exceeds the 5 MB limit.')
      setIncoming(parseProject(await file.text(), snapshot))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cannot load project.')
    } finally {
      setBusy(false)
    }
  }
  function save() {
    const url = URL.createObjectURL(
      new Blob([serializeProject(snapshot, state)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'schema-flow-project.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <dialog
      ref={dialog}
      className="mapping-editor project-dialog"
      aria-label="Project Save and Load"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key !== 'Tab') return
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        ]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault()
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus()
      }}
    >
      <h2>Project Save / Load</h2>
      <p>
        Save review decisions, Undo history, node positions and canvas views for this source
        version. Source documents are referenced, not embedded.
      </p>
      <p role={persistence.error ? 'alert' : 'status'} aria-label="Project storage status">
        {persistence.status}
      </p>
      <button type="button" onClick={save}>
        Save Project
      </button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        Load Project
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept="application/json,.json"
        aria-label="Project file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void load(file)
        }}
      />
      {incoming ? (
        <section aria-label="Project load preview">
          <h3>Replace current project state?</h3>
          <p>
            {incoming.draftIntents.length} review changes;{' '}
            {incoming.importedDecisionSet?.decisions.length ?? 0} imported decisions. Layout:{' '}
            {incoming.workspaceLayout?.direction}.
          </p>
          <p>
            This replaces current decisions and both canvas layouts. Save your current project first
            if you need a backup. Autosave preference remains unchanged.
          </p>
          <button type="button" onClick={() => setIncoming(null)}>
            Cancel load
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({
                type: 'restore-decisions',
                draftIntents: incoming.draftIntents,
                importedDecisionSet: incoming.importedDecisionSet,
                baselineRevisions: incoming.baselineRevisions,
                workspaceLayout: incoming.workspaceLayout ?? DEFAULT_WORKSPACE_LAYOUT,
              })
              onClose()
            }}
          >
            Apply project
          </button>
        </section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button
        type="button"
        disabled={busy || Boolean(incoming)}
        onClick={() =>
          dispatch({ type: 'set-workspace-layout', layout: DEFAULT_WORKSPACE_LAYOUT, reset: true })
        }
      >
        Reset layout
      </button>
      <button type="button" onClick={onClose}>
        Close project
      </button>
    </dialog>
  )
}
export function ProjectControls() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        Project
      </button>
      {open ? <ProjectDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}
