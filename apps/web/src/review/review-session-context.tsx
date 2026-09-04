import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'

import type { WorkspaceSnapshot } from '../data/types'
import { deriveBaselineRevisions } from './decision-factory'
import { materializeReviewSession, type ReviewSessionMaterialization } from './review-engine'
import {
  createInitialReviewSession,
  reviewSessionReducer,
  type ReviewRejectReason,
  type ReviewSessionAction,
  type ReviewSessionState,
} from './review-session'
import {
  projectReviewWorkspace,
  type ProjectedReviewCandidateDetail,
  type ReviewWorkspaceProjection,
} from './review-workspace-adapter'

export interface ReviewSessionContextValue {
  readonly state: ReviewSessionState
  readonly materialization: ReviewSessionMaterialization
  readonly projection: ReviewWorkspaceProjection
  readonly selectedCandidate: ProjectedReviewCandidateDetail | null
  readonly dispatch: Dispatch<ReviewSessionAction>
  readonly selectCandidate: (candidateId: string | null) => void
  readonly acceptCandidate: (candidateId: string) => void
  readonly rejectCandidate: (candidateId: string, reason: ReviewRejectReason, note?: string) => void
  readonly undoLastDraft: () => void
}

const ReviewSessionContext = createContext<ReviewSessionContextValue | null>(null)

function initializeReviewSession(snapshot: WorkspaceSnapshot): ReviewSessionState {
  return createInitialReviewSession({
    projectFingerprint: snapshot.reviewContext.projectFingerprint,
    sourceRevision: snapshot.reviewContext.sourceRevision,
    baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
  })
}

function ReviewSessionProviderInstance({
  snapshot,
  children,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly children: ReactNode
}) {
  const [state, dispatch] = useReducer(reviewSessionReducer, snapshot, initializeReviewSession)
  // Graph materialization is semantic: selection, filters, and preview controls must not
  // rebuild the accepted topology when the immutable draft intent list is unchanged.
  const materialization = useMemo(
    () => materializeReviewSession(snapshot, state),
    [snapshot, state.draftIntents],
  )
  const projection = useMemo(
    () => projectReviewWorkspace(snapshot, materialization),
    [materialization, snapshot],
  )
  const selectedCandidate = state.selectedCandidateId
    ? (projection.details.get(state.selectedCandidateId) ?? null)
    : null

  const selectCandidate = useCallback((candidateId: string | null) => {
    dispatch({ type: 'select-candidate', candidateId })
  }, [])
  const acceptCandidate = useCallback((candidateId: string) => {
    dispatch({ type: 'accept-candidate', candidateId })
  }, [])
  const rejectCandidate = useCallback(
    (candidateId: string, reason: ReviewRejectReason, note?: string) => {
      dispatch({
        type: 'reject-candidate',
        candidateId,
        reason,
        ...(note === undefined ? {} : { note }),
      })
    },
    [],
  )
  const undoLastDraft = useCallback(() => {
    dispatch({ type: 'undo-last-draft' })
  }, [])

  const value = useMemo<ReviewSessionContextValue>(
    () => ({
      state,
      materialization,
      projection,
      selectedCandidate,
      dispatch,
      selectCandidate,
      acceptCandidate,
      rejectCandidate,
      undoLastDraft,
    }),
    [
      acceptCandidate,
      materialization,
      projection,
      rejectCandidate,
      selectCandidate,
      selectedCandidate,
      state,
      undoLastDraft,
    ],
  )

  return <ReviewSessionContext.Provider value={value}>{children}</ReviewSessionContext.Provider>
}

export function ReviewSessionProvider({
  snapshot,
  children,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly children: ReactNode
}) {
  const identity = `${snapshot.reviewContext.projectFingerprint}\u0000${snapshot.reviewContext.sourceRevision}`

  return (
    <ReviewSessionProviderInstance key={identity} snapshot={snapshot}>
      {children}
    </ReviewSessionProviderInstance>
  )
}

export function useReviewSession(): ReviewSessionContextValue {
  const value = useContext(ReviewSessionContext)
  if (!value) {
    throw new Error('useReviewSession must be used within ReviewSessionProvider.')
  }
  return value
}
