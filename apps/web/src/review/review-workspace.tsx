import { countReviewCandidateStates } from './review-selectors'
import { useReviewSession } from './review-session-context'

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function ReviewWorkspace() {
  const { state, materialization, projection, selectedCandidate } = useReviewSession()
  const counts = countReviewCandidateStates(projection.rows)
  const candidateCount = projection.rows.length
  const draftCount = state.draftIntents.length
  const acceptedRelationshipCount = materialization.result.graph.edges.length

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
          <div className="review-foundation-copy">
            <strong>{candidateCount} inference candidates available.</strong>
            <p>Candidate discovery is isolated here from the accepted API topology.</p>
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
        {selectedCandidate ? (
          <div className="review-foundation-copy">
            <strong>{selectedCandidate.sourceLabel}</strong>
            <code>
              {selectedCandidate.sourceSelector} → {selectedCandidate.targetDescriptor}
            </code>
            <span>{selectedCandidate.targetLabel}</span>
          </div>
        ) : (
          <p className="review-empty-copy">
            Select an inference candidate to preview its mapping or topology.
          </p>
        )}
      </section>

      <section
        className="review-panel review-evidence-region"
        role="region"
        aria-labelledby="review-evidence-title"
      >
        <header>
          <span className="eyebrow">RATIONALE</span>
          <h2 id="review-evidence-title">Evidence Inspector</h2>
        </header>
        {selectedCandidate ? (
          <div className="review-foundation-copy">
            <strong>{countLabel(selectedCandidate.evidenceCount, 'evidence item')}</strong>
            <span>{countLabel(selectedCandidate.blockerCount, 'blocker')}</span>
          </div>
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
        <p className="review-empty-copy">
          {selectedCandidate
            ? 'The selected candidate is ready for a review decision.'
            : 'Review actions become available after a candidate is selected.'}
        </p>
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
            <dd>{counts.accepted}</dd>
          </div>
          <div>
            <dt>Needs attention</dt>
            <dd>{counts.conflict + counts.invalid + counts.stale + counts.orphaned}</dd>
          </div>
        </dl>
      </section>

      <footer
        className="review-status-bar"
        role="status"
        aria-label="Review status"
        aria-live="polite"
      >
        <span>{countLabel(draftCount, 'unsaved decision')}</span>
        <span>{countLabel(acceptedRelationshipCount, 'accepted relationship')}</span>
        <span>
          {selectedCandidate ? `Selected ${selectedCandidate.id}` : 'No candidate selected'}
        </span>
      </footer>
    </section>
  )
}
