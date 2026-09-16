import type { FlowDataMapping } from '@api-schema-flow/domain'
import { MappingEditor } from './mapping-editor'
import { effectiveCandidateMapping } from './review-workspace-adapter'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CandidateList } from './candidate-list'
import { EvidenceInspector } from './evidence-inspector'
import { MappingPreview } from './mapping-preview'
import { ReviewFilters } from './review-filters'
import { countReviewCandidateStates, filterAndSortReviewCandidates } from './review-selectors'
import { useReviewSession } from './review-session-context'
import type { ReviewConfidenceBand, ReviewRejectReason } from './review-session'
import { ReviewSummaryTable } from './review-summary-table'
import { ReviewActions } from './review-actions'
import { ReviewStatusBar } from './review-status-bar'
import { RejectDialog } from './reject-dialog'
import { DraftGraphPreview } from './draft-graph-preview'

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

const DEFAULT_CONFIDENCE_BANDS: readonly ReviewConfidenceBand[] = ['high', 'medium']
const ALL_CONFIDENCE_BANDS: readonly ReviewConfidenceBand[] = ['high', 'medium', 'low', 'hidden']

export function ReviewWorkspace() {
  const {
    snapshot,
    state,
    dispatch,
    materialization,
    projection,
    selectedCandidate,
    selectCandidate,
    acceptCandidate,
    rejectCandidate,
    undoLastDraft,
    editCandidate,
  } = useReviewSession()
  const [announcement, setAnnouncement] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const domainCandidate = snapshot.inferenceCandidates.find(
    (item) => item.id === state.selectedCandidateId,
  )
  const pendingAction = useRef<{
    action: 'accept' | 'reject' | 'undo' | 'edit'
    candidateId: string
    visibleIds: readonly string[]
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const evidenceToggleRef = useRef<HTMLButtonElement>(null)
  const counts = countReviewCandidateStates(projection.rows)
  const candidateCount = projection.rows.length
  const draftCount = state.draftIntents.length
  const acceptedRelationshipCount = materialization.result.graph.edges.length
  const visibleRows = useMemo(
    () =>
      filterAndSortReviewCandidates(projection.rows, {
        filters: state.filters,
        sort: state.sort,
      }),
    [projection.rows, state.filters, state.sort],
  )

  useEffect(() => {
    const action = pendingAction.current
    if (!action) return
    pendingAction.current = null
    const reviewed = projection.details.get(action.candidateId)
    if (action.action === 'undo') {
      setAnnouncement(
        `Undid the latest review change. ${reviewed?.sourceLabel ?? 'Candidate'} is ${reviewed?.state ?? 'unavailable'}.`,
      )
      if (visibleRows.some(({ id }) => id === action.candidateId))
        selectCandidate(action.candidateId)
      return
    }
    if (action.action === 'edit') {
      setAnnouncement(
        reviewed?.state === 'edited'
          ? 'Applied manual mapping. Changes are not saved.'
          : `Mapping was not applied: ${reviewed?.outcomeReason ?? reviewed?.state}.`,
      )
      return
    }
    if (reviewed?.state === (action.action === 'accept' ? 'accepted' : 'rejected')) {
      setAnnouncement(
        `${action.action === 'accept' ? 'Accepted' : 'Rejected'} ${reviewed.sourceLabel} → ${reviewed.targetLabel}.`,
      )
      const index = action.visibleIds.indexOf(action.candidateId)
      const nextIds = [...action.visibleIds.slice(index + 1), ...action.visibleIds.slice(0, index)]
      const nextId = nextIds.find((id) =>
        visibleRows.some((row) => row.id === id && row.state === 'pending'),
      )
      selectCandidate(nextId ?? action.candidateId)
    } else {
      setAnnouncement(
        `${action.action === 'accept' ? 'Accept' : 'Reject'} was not applied: ${reviewed?.outcomeReason ?? reviewed?.state ?? 'candidate unavailable'}.`,
      )
    }
  }, [materialization, projection, selectCandidate, visibleRows])

  function acceptSelectedCandidate() {
    if (!selectedCandidate) return
    pendingAction.current = {
      action: 'accept',
      candidateId: selectedCandidate.id,
      visibleIds: visibleRows.map(({ id }) => id),
    }
    acceptCandidate(selectedCandidate.id)
  }

  function rejectSelectedCandidate(reason: ReviewRejectReason, note?: string) {
    if (!selectedCandidate) return
    pendingAction.current = {
      action: 'reject',
      candidateId: selectedCandidate.id,
      visibleIds: visibleRows.map(({ id }) => id),
    }
    rejectCandidate(selectedCandidate.id, reason, note)
    setRejectOpen(false)
  }

  function applyMapping(mapping: FlowDataMapping) {
    if (!selectedCandidate) return
    pendingAction.current = { action: 'edit', candidateId: selectedCandidate.id, visibleIds: [] }
    editCandidate(selectedCandidate.id, mapping)
    setEditOpen(false)
  }

  function undoLatestChange() {
    const intent = state.draftIntents.at(-1)
    if (!intent) return
    pendingAction.current = { action: 'undo', candidateId: intent.candidateId, visibleIds: [] }
    undoLastDraft()
  }

  const resetFilters = useCallback(() => {
    dispatch({ type: 'set-query', query: '' })
    dispatch({ type: 'set-review-state', state: 'pending' })
    dispatch({ type: 'set-blockers-only', enabled: false })
    dispatch({ type: 'set-sort', sort: 'confidence-desc' })
    for (const band of ALL_CONFIDENCE_BANDS) {
      const enabled = state.filters.confidenceBands.includes(band)
      const shouldEnable = DEFAULT_CONFIDENCE_BANDS.includes(band)
      if (enabled !== shouldEnable) dispatch({ type: 'toggle-confidence', band })
    }
  }, [dispatch, state.filters.confidenceBands])

  const closeEvidence = useCallback(() => {
    if (state.evidenceOpen) dispatch({ type: 'toggle-evidence' })
    evidenceToggleRef.current?.focus()
  }, [dispatch, state.evidenceOpen])

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || rejectOpen || editOpen) return
      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key !== 'Escape') return

      if (state.evidenceOpen && selectedCandidate) {
        event.preventDefault()
        closeEvidence()
        return
      }

      if (state.filters.query) {
        event.preventDefault()
        dispatch({ type: 'set-query', query: '' })
        return
      }

      if (state.selectedCandidateId) {
        event.preventDefault()
        selectCandidate(null)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    closeEvidence,
    dispatch,
    selectCandidate,
    selectedCandidate,
    state.evidenceOpen,
    state.filters.query,
    state.selectedCandidateId,
    rejectOpen,
    editOpen,
  ])

  return (
    <section className="review-workspace" role="region" aria-label="Inference Review workspace">
      <header className="review-workspace__header">
        <div>
          <span className="eyebrow">HUMAN REVIEW</span>
          <h1 id="inference-review-title">Inference Review</h1>
          <p>
            Inspect suggested data relationships before they become part of the accepted topology.
          </p>
        </div>
        <div className="review-workspace__identity" aria-label="Review source identity">
          <span>{state.projectFingerprint}</span>
          <code>{state.sourceRevision}</code>
        </div>
      </header>

      <section
        className="review-panel review-candidates-region"
        role="region"
        aria-labelledby="review-candidates-title"
      >
        <header>
          <span className="eyebrow">DISCOVERY</span>
          <h2 id="review-candidates-title">Candidate List</h2>
        </header>
        {candidateCount === 0 ? (
          <p className="review-empty-copy">
            No inference candidates are available in this snapshot.
          </p>
        ) : (
          <div className="review-discovery-stack">
            <p className="review-candidate-total">
              <strong>{candidateCount} inference candidates available.</strong>
              <span> Candidate discovery is isolated from the accepted API topology.</span>
            </p>
            <ReviewFilters
              filters={state.filters}
              sort={state.sort}
              visibleCount={visibleRows.length}
              totalCount={candidateCount}
              empty={visibleRows.length === 0}
              searchInputRef={searchInputRef}
              onQueryChange={(query) => dispatch({ type: 'set-query', query })}
              onToggleConfidence={(band) => dispatch({ type: 'toggle-confidence', band })}
              onReviewStateChange={(reviewState) =>
                dispatch({ type: 'set-review-state', state: reviewState })
              }
              onBlockersOnlyChange={(enabled) => dispatch({ type: 'set-blockers-only', enabled })}
              onSortChange={(sort) => dispatch({ type: 'set-sort', sort })}
              onReset={resetFilters}
            />
            <CandidateList
              candidates={visibleRows}
              selectedCandidateId={state.selectedCandidateId}
              onSelect={selectCandidate}
              emptyMessage="Reset the review filters to see the available candidates."
            />
          </div>
        )}
      </section>

      <section
        className="review-panel review-preview-region"
        role="region"
        aria-labelledby="review-preview-title"
      >
        <header>
          <span className="eyebrow">PREVIEW</span>
          <h2 id="review-preview-title">Mapping or Topology Preview</h2>
        </header>
        <div className="review-preview-switch" role="group" aria-label="Preview mode">
          <button
            type="button"
            aria-pressed={state.previewMode === 'mapping'}
            onClick={() => dispatch({ type: 'set-preview-mode', mode: 'mapping' })}
          >
            Mapping preview
          </button>
          <button
            type="button"
            aria-pressed={state.previewMode === 'topology'}
            onClick={() => dispatch({ type: 'set-preview-mode', mode: 'topology' })}
          >
            Topology preview
          </button>
          <button
            type="button"
            disabled={
              !selectedCandidate ||
              !['pending', 'accepted', 'rejected', 'edited'].includes(selectedCandidate.state)
            }
            onClick={() => setEditOpen(true)}
          >
            Edit Mapping
          </button>
        </div>
        {state.previewMode === 'topology' ? (
          <DraftGraphPreview
            snapshot={snapshot}
            graph={materialization.result.graph}
            pendingCount={counts.pending}
          />
        ) : (
          <MappingPreview candidate={selectedCandidate} />
        )}
      </section>

      <section
        className="review-panel review-evidence-region"
        role="region"
        aria-labelledby="review-evidence-title"
      >
        <header className="review-panel__split-header">
          <div>
            <span className="eyebrow">RATIONALE</span>
            <h2 id="review-evidence-title">Evidence Inspector</h2>
          </div>
          {selectedCandidate ? (
            <button
              ref={evidenceToggleRef}
              type="button"
              className="text-button"
              aria-expanded={state.evidenceOpen}
              onClick={() => dispatch({ type: 'toggle-evidence' })}
            >
              {state.evidenceOpen ? 'Hide evidence' : 'Show evidence'}
            </button>
          ) : null}
        </header>
        {selectedCandidate ? (
          state.evidenceOpen ? (
            <EvidenceInspector candidate={selectedCandidate} open onClose={closeEvidence} />
          ) : (
            <p className="review-empty-copy">Evidence is hidden for the selected candidate.</p>
          )
        ) : (
          <p className="review-empty-copy">
            Select an inference candidate to inspect its evidence.
          </p>
        )}
      </section>

      <section
        className="review-panel review-actions-region"
        role="region"
        aria-labelledby="review-actions-title"
      >
        <header>
          <span className="eyebrow">DECISION</span>
          <h2 id="review-actions-title">Review Actions</h2>
        </header>
        <ReviewActions
          candidate={selectedCandidate}
          onAccept={acceptSelectedCandidate}
          onReject={() => setRejectOpen(true)}
        />
        {editOpen && domainCandidate ? (
          <MappingEditor
            snapshot={snapshot}
            candidate={domainCandidate}
            mapping={effectiveCandidateMapping(domainCandidate, materialization)}
            onCancel={() => setEditOpen(false)}
            onApply={applyMapping}
          />
        ) : null}
        {rejectOpen && selectedCandidate ? (
          <RejectDialog
            candidateLabel={`${selectedCandidate.sourceLabel} → ${selectedCandidate.targetLabel}`}
            onCancel={() => setRejectOpen(false)}
            onConfirm={rejectSelectedCandidate}
          />
        ) : null}
      </section>

      <section
        className="review-panel review-summary-region"
        role="region"
        aria-labelledby="review-summary-title"
      >
        <header>
          <span className="eyebrow">NON-SPATIAL VIEW</span>
          <h2 id="review-summary-title">Review Summary</h2>
        </header>
        <dl className="review-summary-counts">
          <div>
            <dt>Candidates</dt>
            <dd>{countLabel(candidateCount, 'candidate')}</dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd>{counts.pending}</dd>
          </div>
          <div>
            <dt>Accepted</dt>
            <dd>{counts.accepted + counts.edited}</dd>
          </div>
          <div>
            <dt>Needs attention</dt>
            <dd>{counts.conflict + counts.invalid + counts.stale + counts.orphaned}</dd>
          </div>
        </dl>
        <ReviewSummaryTable
          candidates={visibleRows}
          selectedCandidateId={state.selectedCandidateId}
          onSelect={selectCandidate}
        />
      </section>

      <ReviewStatusBar
        draftCount={draftCount}
        edgeCount={acceptedRelationshipCount}
        selectedId={state.selectedCandidateId}
        announcement={announcement}
        onUndo={undoLatestChange}
      />
    </section>
  )
}
