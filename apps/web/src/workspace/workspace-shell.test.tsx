import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createReviewWorkspaceFixture } from '../test/review-workspace-fixture'
import { WorkspaceShell } from './workspace-shell'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WorkspaceShell', () => {
  test('hides M3-A side panels in Review and restores their preserved state in Topology', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    render(<WorkspaceShell snapshot={createReviewWorkspaceFixture()} />)

    const search = screen.getByPlaceholderText('Search path or operation ID')
    await user.type(search, 'reserv')
    await user.click(screen.getByRole('button', { name: /POST.*\/reservations/i }))
    expect(screen.getByRole('complementary', { name: 'Endpoint inspector' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Close inspector' }))
    await user.click(screen.getByRole('button', { name: 'Collapse operations panel' }))
    await user.click(screen.getByRole('button', { name: 'Inference Review' }))

    expect(screen.getByRole('heading', { name: 'Inference Review' })).toBeVisible()
    expect(screen.queryByRole('complementary', { name: 'API operations' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open operations panel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open inspector' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Topology' }))

    const openOperations = screen.getByRole('button', { name: 'Open operations panel' })
    const openInspector = screen.getByRole('button', { name: 'Open inspector' })
    expect(openOperations).toBeVisible()
    expect(openInspector).toBeVisible()

    await user.click(openOperations)
    expect(screen.getByPlaceholderText('Search path or operation ID')).toHaveValue('reserv')

    await user.click(openInspector)
    const inspector = screen.getByRole('complementary', { name: 'Endpoint inspector' })
    expect(inspector).toBeVisible()
    expect(within(inspector).getByText('Create reservation')).toBeVisible()
  })

  test('keeps Outline as a real destination alongside Topology and Inference Review', async () => {
    const user = userEvent.setup()
    render(<WorkspaceShell snapshot={createReviewWorkspaceFixture()} />)

    await user.click(screen.getByRole('button', { name: 'Outline' }))

    expect(
      screen.getByRole('heading', { name: 'Operation and relationship outline' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-current', 'page')
  })
})
