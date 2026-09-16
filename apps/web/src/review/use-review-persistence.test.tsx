import { useReducer } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import raw from '../../public/fixtures/reservation-workspace.json'
import type { WorkspaceSnapshot } from '../data/types'
import { initialStoredSession, encodeStoredReview } from './review-transfer'
import { reviewSessionReducer } from './review-session'
import { useReviewPersistence } from './use-review-persistence'
import { readStoredReview, writeStoredReview, resetStoredReview } from './review-storage'

vi.mock('./review-storage', () => ({
  readStoredReview: vi.fn(),
  writeStoredReview: vi.fn(),
  resetStoredReview: vi.fn(),
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

test('clears only after an in-flight write and prevents queued decisions from returning', async () => {
  vi.stubGlobal('indexedDB', {})
  vi.mocked(readStoredReview).mockResolvedValue(undefined)
  vi.mocked(resetStoredReview).mockResolvedValue(2)
  let complete!: (generation: number) => void
  vi.mocked(writeStoredReview).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
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
  let clearing!: Promise<void>
  act(() => {
    clearing = hook.result.current.clearAndDisable()
  })
  expect(resetStoredReview).not.toHaveBeenCalled()
  await act(async () => {
    complete(1)
    await clearing
  })
  expect(resetStoredReview).toHaveBeenCalledWith(
    expect.any(String),
    0,
    expect.objectContaining({
      autosave: false,
      schemaVersion: '2.0',
      toolVersion: expect.any(String),
    }),
  )
  expect(hook.result.current.enabled).toBe(false)
  hook.rerender({ state: initial })
  hook.rerender({ state: edited })
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(writeStoredReview).toHaveBeenCalledTimes(1)
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

test('hydrates legacy v1 without rewriting it until the first user change', async () => {
  vi.stubGlobal('indexedDB', {})
  const snapshot = raw as unknown as WorkspaceSnapshot
  const initial = initialStoredSession(snapshot)
  const encoded = encodeStoredReview(snapshot, initial)
  const value = {
    version: 1,
    schemaVersion: '1.0',
    toolVersion: '0.0.0',
    baseline: encoded.baseline,
    draftIntents: [],
  }
  const before = JSON.stringify(value)
  vi.mocked(readStoredReview).mockResolvedValue({ generation: 7, value })
  vi.mocked(writeStoredReview).mockResolvedValue(8)
  const hook = renderHook(() => {
    const [state, dispatch] = useReducer(reviewSessionReducer, initial)
    return { persistence: useReviewPersistence(snapshot, state, dispatch), dispatch }
  })
  await waitFor(() => expect(hook.result.current.persistence.ready).toBe(true))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150))
  })
  expect(writeStoredReview).not.toHaveBeenCalled()
  expect(JSON.stringify(value)).toBe(before)
  act(() =>
    hook.result.current.dispatch({
      type: 'accept-candidate',
      candidateId: snapshot.inferenceCandidates[0]!.id,
    }),
  )
  await waitFor(() => expect(writeStoredReview).toHaveBeenCalledTimes(1))
  expect(vi.mocked(writeStoredReview).mock.calls[0]).toEqual([
    expect.any(String),
    7,
    expect.objectContaining({
      version: 2,
      schemaVersion: '2.0',
      workspaceLayout: expect.any(Object),
    }),
  ])
})
