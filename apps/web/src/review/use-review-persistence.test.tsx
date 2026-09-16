import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import raw from '../../public/fixtures/reservation-workspace.json'
import type { WorkspaceSnapshot } from '../data/types'
import { initialStoredSession } from './review-transfer'
import { reviewSessionReducer } from './review-session'
import { useReviewPersistence } from './use-review-persistence'
import { readStoredReview, writeStoredReview } from './review-storage'

vi.mock('./review-storage', () => ({ readStoredReview: vi.fn(), writeStoredReview: vi.fn() }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

test('persists Undo even when the previous write is still in flight', async () => {
  vi.stubGlobal('indexedDB', {})
  vi.mocked(readStoredReview).mockResolvedValue(undefined)
  let complete!: (generation: number) => void
  vi.mocked(writeStoredReview)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    .mockResolvedValue(2)
  const snapshot = raw as unknown as WorkspaceSnapshot
  const initial = initialStoredSession(snapshot)
  const dispatch = vi.fn()
  const hook = renderHook(({ state }) => useReviewPersistence(snapshot, state, dispatch), {
    initialProps: { state: initial },
  })
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  const edited = reviewSessionReducer(initial, {
    type: 'accept-candidate',
    candidateId: snapshot.inferenceCandidates[0]!.id,
  })
  hook.rerender({ state: edited })
  await waitFor(() => expect(writeStoredReview).toHaveBeenCalledTimes(1))
  hook.rerender({ state: initial })
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  await act(async () => complete(1))
  await waitFor(() => expect(writeStoredReview).toHaveBeenCalledTimes(2))
  expect(vi.mocked(writeStoredReview).mock.calls[1]![2]).toMatchObject({ draftIntents: [] })
  await waitFor(() => expect(hook.result.current.status).toBe('Saved locally'))
})
