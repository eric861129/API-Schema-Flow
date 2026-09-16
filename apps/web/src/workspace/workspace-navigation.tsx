export type WorkspaceDestination = 'topology' | 'outline' | 'inference-review'

interface WorkspaceNavigationProps {
  readonly activeDestination: WorkspaceDestination
  readonly diagnosticsOpen: boolean
  readonly onDestinationChange: (destination: WorkspaceDestination) => void
  readonly onToggleDiagnostics: () => void
  readonly onShowAbout: () => void
}

const destinations: readonly {
  readonly id: WorkspaceDestination
  readonly label: string
  readonly icon: string
}[] = [
  { id: 'topology', label: 'Topology', icon: '⌘' },
  { id: 'outline', label: 'Outline', icon: '☷' },
  { id: 'inference-review', label: 'Inference Review', icon: '◎' },
]

export function WorkspaceNavigation({
  activeDestination,
  diagnosticsOpen,
  onDestinationChange,
  onToggleDiagnostics,
  onShowAbout,
}: WorkspaceNavigationProps) {
  return (
    <nav className="icon-rail" aria-label="Workspace views">
      {destinations.map((destination) => (
        <button
          type="button"
          key={destination.id}
          aria-current={activeDestination === destination.id ? 'page' : undefined}
          onClick={() => onDestinationChange(destination.id)}
        >
          <span aria-hidden="true">{destination.icon}</span>
          <small>{destination.label}</small>
        </button>
      ))}
      <button type="button" aria-expanded={diagnosticsOpen} onClick={onToggleDiagnostics}>
        <span aria-hidden="true">◇</span>
        <small>Diagnostics</small>
      </button>
      <button type="button" onClick={onShowAbout}>
        <span aria-hidden="true">i</span>
        <small>About</small>
      </button>
    </nav>
  )
}
