import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { KeyboardEvent } from 'react'

import type { HttpMethod } from '@api-schema-flow/domain'
import { MAX_CANVAS_OPERATIONS } from '../graph/canvas-limits'
import {
  groupOperationViewModels,
  type OperationViewModel,
} from '../workspace/operation-view-model'

const methods: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete']

interface OperationsPanelProps {
  readonly models: readonly OperationViewModel[]
  readonly visibleModels: readonly OperationViewModel[]
  readonly query: string
  readonly activeMethods: readonly HttpMethod[]
  readonly selectedTag: string
  readonly focusNodeIds?: ReadonlySet<string>
  readonly selectedNodeId: string | null
  readonly onQueryChange: (query: string) => void
  readonly onMethodsChange: (methods: readonly HttpMethod[]) => void
  readonly onTagChange: (tag: string) => void
  readonly onChooseGroup: (tag: string) => void
  readonly onFocusSelection: () => void
  readonly onClearFocus: () => void
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
  const { t } = useTranslation()
  const visible = props.visibleModels
  const [rowLimit, setRowLimit] = useState(80)
  const [groupLimit, setGroupLimit] = useState(6)
  useEffect(() => setRowLimit(80), [visible])
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of props.models) {
      for (const tag of new Set(model.operation.tags.length ? model.operation.tags : ['Untagged']))
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()].sort(
      ([leftTag, leftCount], [rightTag, rightCount]) =>
        rightCount - leftCount || leftTag.localeCompare(rightTag),
    )
  }, [props.models])
  const tags = useMemo(
    () => groupCounts.map(([tag]) => tag).toSorted((left, right) => left.localeCompare(right)),
    [groupCounts],
  )
  const displayed = visible.slice(
    0,
    visible.length > MAX_CANVAS_OPERATIONS ? rowLimit : visible.length,
  )
  const groups = groupOperationViewModels(displayed)

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
    <aside className="operations-panel" aria-label={t('API operations')}>
      <header className="panel-heading">
        <div>
          <span className="eyebrow">{t('OPERATIONS')}</span>
          <strong>{t('{{total}} visible', { total: visible.length })}</strong>
        </div>
        <button
          className="icon-button"
          onClick={props.onCollapse}
          aria-label={t('Collapse operations panel')}
        >
          ‹
        </button>
      </header>
      <label className="search-field">
        <span className="sr-only">{t('Search operations')}</span>
        <span aria-hidden="true">⌕</span>
        <input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder={t('Search path or operation ID')}
        />
      </label>
      <div className="method-filters" aria-label={t('Filter by HTTP method')}>
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
      <div className="operation-scope">
        <label>
          <span className="sr-only">{t('Filter by group')}</span>
          <select
            value={props.selectedTag}
            onChange={(event) => props.onTagChange(event.target.value)}
          >
            <option value="">{t('All groups')}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        {props.focusNodeIds ? (
          <button type="button" onClick={props.onClearFocus}>
            {t('Clear focus')}
          </button>
        ) : null}
      </div>
      {props.models.length > MAX_CANVAS_OPERATIONS ? (
        <section className="operation-groups" aria-label={t('Browse API groups')}>
          <div className="operation-groups__heading">
            <strong>{t('Browse API groups')}</strong>
            <small>{t('{{count}} groups', { count: groupCounts.length })}</small>
          </div>
          <div className="operation-groups__items">
            {groupCounts.slice(0, groupLimit).map(([group, count]) => (
              <button
                type="button"
                key={group}
                aria-pressed={props.selectedTag === group}
                title={group}
                onClick={() => props.onChooseGroup(props.selectedTag === group ? '' : group)}
              >
                <span>{group}</span>
                <small>{count}</small>
              </button>
            ))}
          </div>
          {groupLimit < groupCounts.length ? (
            <button
              type="button"
              className="operation-groups__more"
              onClick={() => setGroupLimit((value) => value + 12)}
            >
              {t('Show more groups')}
            </button>
          ) : null}
          {groupLimit > 6 ? (
            <button
              type="button"
              className="operation-groups__more"
              onClick={() => setGroupLimit(6)}
            >
              {t('Show fewer groups')}
            </button>
          ) : null}
        </section>
      ) : null}
      {props.models.length > MAX_CANVAS_OPERATIONS && props.selectedNodeId ? (
        <button type="button" className="focus-selection" onClick={props.onFocusSelection}>
          {t('Focus selected endpoint')}
        </button>
      ) : null}
      <div className="operation-list" onKeyDown={handleKeyDown}>
        {visible.length === 0 ? (
          <div className="empty-filter">
            <strong>{t('No matching operations')}</strong>
            <p>{t('Clear filters or focus to restore the topology.')}</p>
            <button
              onClick={() => {
                props.onClearFocus()
                props.onQueryChange('')
                props.onMethodsChange([])
                props.onTagChange('')
              }}
            >
              {t('Clear filters')}
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
                  aria-label={t('{{incoming}} incoming and {{outgoing}} outgoing relationships', {
                    incoming: model.incoming,
                    outgoing: model.outgoing,
                  })}
                >
                  {model.incoming}↓ {model.outgoing}↑
                </span>
              </button>
            ))}
          </section>
        ))}
        {displayed.length < visible.length ? (
          <div className="operation-list__more">
            <span>
              {t('Showing {{shown}} of {{total}} endpoints', {
                shown: displayed.length,
                total: visible.length,
              })}
            </span>
            <button type="button" onClick={() => setRowLimit((value) => value + 80)}>
              {t('Load more endpoints')}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
