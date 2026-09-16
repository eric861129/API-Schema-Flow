import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { WorkspaceNavigation, type WorkspaceDestination } from './workspace-navigation'

function NavigationHarness({ onShowAbout }: { readonly onShowAbout: () => void }) {
  const [destination, setDestination] = useState<WorkspaceDestination>('topology')
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  return (
    <WorkspaceNavigation
      activeDestination={destination}
      diagnosticsOpen={diagnosticsOpen}
      onDestinationChange={setDestination}
      onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
      onShowAbout={onShowAbout}
    />
  )
}

describe('WorkspaceNavigation', () => {
  test('offers only the three implemented workspace destinations', () => {
    render(<NavigationHarness onShowAbout={() => undefined} />)

    expect(screen.getByRole('navigation', { name: 'Workspace views' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Topology' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Outline' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Inference Review' })).toBeVisible()

    for (const name of ['Workflows', 'Mock', 'Run', 'Save', 'Import', 'Export']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  test('changes destinations while keeping Diagnostics and About as actions', async () => {
    const user = userEvent.setup()
    const onShowAbout = vi.fn()
    render(<NavigationHarness onShowAbout={onShowAbout} />)

    await user.click(screen.getByRole('button', { name: 'Inference Review' }))
    expect(screen.getByRole('button', { name: 'Inference Review' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    const diagnostics = screen.getByRole('button', { name: 'Diagnostics' })
    await user.click(diagnostics)
    expect(diagnostics).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Inference Review' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(onShowAbout).toHaveBeenCalledOnce()
  })
})
