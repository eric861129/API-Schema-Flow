import type { KeyboardEvent } from 'react'

import type { HttpMethod } from '../data/types'
import {
  filterOperationViewModels,
  groupOperationViewModels,
  type OperationViewModel,
} from '../workspace/operation-view-model'

const methods: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete']

interface OperationsPanelProps {
  readonly models: readonly OperationViewModel[]
  readonly query: string
  readonly activeMethods: readonly HttpMethod[]
  readonly selectedNodeId: string | null
  readonly onQueryChange: (query: string) => void
  readonly onMethodsChange: (methods: readonly HttpMethod[]) => void
  readonly onSelect: (nodeId: string) => void
  readonly onCollapse: () => void
}

export function MethodBadge({ method }: { readonly method: HttpMethod }) {
  return (
    <span className={'method-badge method-' + method}>
      <span aria-hidden="true">◆</span>
      {method.toUpperCase()}
    </span>
  )
}

export function OperationsPanel(props: OperationsPanelProps) {
  const visible = filterOperationViewModels(props.models, {
    query: props.query,
    methods: props.activeMethods,
  })
  const groups = groupOperationViewModels(visible)

  function toggle(method: HttpMethod) {
    props.onMethodsChange(
      props.activeMethods.includes(method)
        ? props.activeMethods.filter((item) => item !== method)
        : [...props.activeMethods, method],
    )
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-operation-row]'),
    ]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'ArrowDown'
        ? Math.min(buttons.length - 1, current + 1)
        : Math.max(0, current - 1)
    buttons[next]?.focus()
    event.preventDefault()
  }

  return (
    <aside className="operations-panel" aria-label="API operations">
      <header className="panel-heading">
        <div>
          <span className="eyebrow">OPERATIONS</span>
          <strong>{visible.length} visible</strong>
        </div>
        <button
          className="icon-button"
          onClick={props.onCollapse}
          aria-label="Collapse operations panel"
        >
          ‹
        </button>
      </header>
      <label className="search-field">
        <span className="sr-only">Search operations</span>
        <span aria-hidden="true">⌕</span>
        <input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search path or operation ID"
        />
      </label>
      <div className="method-filters" aria-label="Filter by HTTP method">
        {methods.map((method) => (
          <button
            key={method}
            aria-pressed={props.activeMethods.includes(method)}
            onClick={() => toggle(method)}
          >
            {method.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="operation-list" onKeyDown={handleKeyDown}>
        {visible.length === 0 ? (
          <div className="empty-filter">
            <strong>No matching operations</strong>
            <p>Clear the search or method filters to restore the topology.</p>
            <button
              onClick={() => {
                props.onQueryChange('')
                props.onMethodsChange([])
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
        {[...groups.entries()].map(([tag, items]) => (
          <section key={tag} aria-labelledby={'tag-' + tag}>
            <h2 id={'tag-' + tag}>{tag}</h2>
            {items.map((model) => (
              <button
                data-operation-row
                key={model.nodeId}
                className="operation-row"
                aria-pressed={props.selectedNodeId === model.nodeId}
                onClick={() => props.onSelect(model.nodeId)}
              >
                <MethodBadge method={model.operation.method} />
                <span className="operation-copy">
                  <code>{model.operation.path}</code>
                  <small>{model.operation.summary ?? model.operation.operationId}</small>
                </span>
                <span
                  className="connection-count"
                  aria-label={
                    model.incoming + ' incoming and ' + model.outgoing + ' outgoing relationships'
                  }
                >
                  {model.incoming}↓ {model.outgoing}↑
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  )
}
