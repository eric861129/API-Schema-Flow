import { useEffect, useRef, useState, type Dispatch } from 'react'
import type { WorkspaceSnapshot } from '../data/types'
import type { ReviewSessionAction, ReviewSessionState } from './review-session'
import { decodeStoredReview, encodeStoredReview, initialStoredSession } from './review-transfer'
import { readStoredReview, writeStoredReview } from './review-storage'

export function useReviewPersistence(
  snapshot: WorkspaceSnapshot,
  state: ReviewSessionState,
  dispatch: Dispatch<ReviewSessionAction>,
) {
  const available = typeof indexedDB !== 'undefined'
  const [ready, setReady] = useState(!available)
  const [status, setStatus] = useState(
    available
      ? 'Loading saved decisions…'
      : 'Local storage unavailable. Export decisions before closing.',
  )
  const [error, setError] = useState(!available)
  const [reload, setReload] = useState(0)
  const [writeRevision, setWriteRevision] = useState(0)
  const generation = useRef(0)
  const saved = useRef('')
  const queue = useRef(Promise.resolve())
  const pendingWrites = useRef(0)
  const epoch = useRef(0)
  const key = JSON.stringify([
    snapshot.reviewContext.projectFingerprint,
    snapshot.reviewContext.sourceRevision,
  ])
  const payload = JSON.stringify(encodeStoredReview(snapshot, state))
  const latest = useRef(payload)
  latest.current = payload

  useEffect(() => {
    if (!available) return
    let cancelled = false
    const currentEpoch = ++epoch.current
    setReady(false)
    setError(false)
    setStatus('Loading saved decisions…')
    // 等待本分頁既有寫入結束，再重新取得儲存世代。
    void queue.current
      .then(() => readStoredReview(key))
      .then((record) => {
        if (cancelled) return
        if (record && (!Number.isSafeInteger(record.generation) || record.generation < 1))
          throw new Error('Stored review generation is damaged.')
        const restored = record
          ? decodeStoredReview(snapshot, record.value)
          : initialStoredSession(snapshot)
        generation.current = record?.generation ?? 0
        saved.current = JSON.stringify(encodeStoredReview(snapshot, restored))
        dispatch({
          type: 'restore-decisions',
          draftIntents: restored.draftIntents,
          importedDecisionSet: restored.importedDecisionSet,
          baselineRevisions: restored.baselineRevisions,
        })
        setStatus(record ? 'Saved locally' : 'No saved changes')
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(true)
          setStatus(reason instanceof Error ? reason.message : 'Cannot restore local decisions.')
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
      if (epoch.current === currentEpoch) epoch.current += 1
    }
  }, [available, dispatch, key, reload, snapshot])

  useEffect(() => {
    if (!ready || error || !available) return
    if (payload === saved.current) {
      if (pendingWrites.current === 0)
        setStatus(generation.current ? 'Saved locally' : 'No saved changes')
      return
    }
    setStatus('Saving locally…')
    const currentEpoch = epoch.current
    const timer = window.setTimeout(() => {
      pendingWrites.current += 1
      queue.current = queue.current
        .then(async () => {
          if (currentEpoch !== epoch.current) return
          generation.current = await writeStoredReview(key, generation.current, JSON.parse(payload))
          saved.current = payload
        })
        .catch((reason: unknown) => {
          epoch.current += 1
          setError(true)
          setStatus(reason instanceof Error ? reason.message : 'Local save failed.')
        })
        .finally(() => {
          pendingWrites.current -= 1
          setWriteRevision((value) => value + 1)
        })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [available, error, key, payload, ready, writeRevision])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (ready && (latest.current !== saved.current || pendingWrites.current > 0))
        event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [ready])

  return { ready, status, error, reloadSaved: () => setReload((value) => value + 1), key }
}
