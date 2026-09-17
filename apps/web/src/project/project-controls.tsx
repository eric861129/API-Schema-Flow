import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useReviewSession } from '../review/review-session-context'
import type { ReviewSessionState } from '../review/review-session'
import { MAX_DECISION_FILE_BYTES } from '../review/review-transfer'
import { DEFAULT_WORKSPACE_LAYOUT } from './workspace-layout'
import { parseProject, serializeProject } from './project-file'

function ProjectDialog({ onClose }: { readonly onClose: () => void }) {
  const { localize, t } = useI18n()
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
      setError(localize(reason instanceof Error ? reason.message : 'Cannot load project.'))
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
      aria-label={t('Project Save and Load')}
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
      <h2>{t('Project Save / Load')}</h2>
      <p>
        {t(
          'Save review decisions, Undo history, node positions and canvas views for this source version. Source documents are referenced, not embedded.',
        )}
      </p>
      <p role={persistence.error ? 'alert' : 'status'} aria-label={t('Project storage status')}>
        {localize(persistence.status)}
      </p>
      <button type="button" onClick={save}>
        {t('Save Project')}
      </button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {t('Load Project')}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept="application/json,.json"
        aria-label={t('Project file')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void load(file)
        }}
      />
      {incoming ? (
        <section aria-label={t('Project load preview')}>
          <h3>{t('Replace current project state?')}</h3>
          <p>
            {t(
              '{{changes}} review changes; {{decisions}} imported decisions. Layout: {{layout}}.',
              {
                changes: incoming.draftIntents.length,
                decisions: incoming.importedDecisionSet?.decisions.length ?? 0,
                layout: t(
                  incoming.workspaceLayout?.direction === 'right' ? 'Horizontal' : 'Vertical',
                ),
              },
            )}
          </p>
          <p>
            {t(
              'This replaces current decisions and both canvas layouts. Save your current project first if you need a backup. Autosave preference remains unchanged.',
            )}
          </p>
          <button type="button" onClick={() => setIncoming(null)}>
            {t('Cancel load')}
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
            {t('Apply project')}
          </button>
        </section>
      ) : null}
      {error ? <p role="alert">{localize(error)}</p> : null}
      <button
        type="button"
        disabled={busy || Boolean(incoming)}
        onClick={() =>
          dispatch({ type: 'set-workspace-layout', layout: DEFAULT_WORKSPACE_LAYOUT, reset: true })
        }
      >
        {t('Reset layout')}
      </button>
      <button type="button" onClick={onClose}>
        {t('Close project')}
      </button>
    </dialog>
  )
}
export function ProjectControls() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        {t('Project')}
      </button>
      {open ? <ProjectDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}
