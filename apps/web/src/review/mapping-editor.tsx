import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FlowDataMapping, InferenceCandidate } from '@api-schema-flow/domain'
import type { WorkspaceSnapshot } from '../data/types'
import {
  createMappingCatalog,
  initialFieldSelection,
  validateMappingEdit,
  type MappingField,
} from './mapping-editor-model'
import { selectorLabel, targetLabel } from './review-workspace-adapter'
import { useI18n } from '../i18n'
import './mapping-editor.css'

function FieldPicker<T>({
  title,
  fields,
  selected,
  indices,
  onSelect,
  onIndex,
}: {
  readonly title: string
  readonly fields: readonly MappingField<T>[]
  readonly selected: string
  readonly indices: readonly string[]
  readonly onSelect: (id: string) => void
  readonly onIndex: (index: number, value: string) => void
}) {
  const { localize, t } = useI18n()
  const id = useId()
  const field = fields.find((item) => item.id === selected)
  return (
    <fieldset className="mapping-field-picker">
      <legend>{title}</legend>
      <div className="mapping-field-tree">
        {fields.length === 0 ? (
          <p>{t('No supported fields in this schema.')}</p>
        ) : (
          fields.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name={id}
                value={item.id}
                checked={selected === item.id}
                onChange={() => onSelect(item.id)}
              />
              <span>
                <code>{item.label}</code>
                <small>
                  {item.schema.types.join(' | ') || 'unknown'} ·{' '}
                  {item.required ? t('required') : t('optional')}
                  {item.unavailable ? ` · ${localize(item.unavailable)}` : ''}
                </small>
              </span>
            </label>
          ))
        )}
      </div>
      {field?.arraySlots.map((slot, index) => (
        <label className="mapping-index" key={slot}>
          {t('{{title}} array index {{index}}', { title, index: index + 1 })}
          <input
            inputMode="numeric"
            value={indices[index] ?? ''}
            placeholder={t('Choose index, e.g. 0')}
            onChange={(event) => onIndex(index, event.currentTarget.value)}
          />
        </label>
      ))}
    </fieldset>
  )
}

/** 使用原生模態對話框隔離背景與焦點，只有套用才建立審查意圖。 */
export function MappingEditor({
  snapshot,
  candidate,
  mapping,
  onCancel,
  onApply,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly candidate: InferenceCandidate
  readonly mapping: FlowDataMapping
  readonly onCancel: () => void
  readonly onApply: (mapping: FlowDataMapping) => void
}) {
  const { localize, t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const catalog = useMemo(() => createMappingCatalog(snapshot, candidate), [snapshot, candidate])
  const [source, setSource] = useState(() => initialFieldSelection(catalog.sources, mapping.source))
  const [target, setTarget] = useState(() => initialFieldSelection(catalog.targets, mapping.target))
  const [template, setTemplate] = useState(
    () => mapping.transform?.raw.replace(/\{\$[^}]+\}/g, '{$value}') ?? '',
  )
  const validation = useMemo(
    () =>
      validateMappingEdit(catalog, {
        sourceId: source.id,
        targetId: target.id,
        sourceIndices: source.indices,
        targetIndices: target.indices,
        template,
      }),
    [catalog, source, target, template],
  )
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current!
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  const sourceField = catalog.sources.find((item) => item.id === source.id)
  const example = sourceField?.schema.example ?? sourceField?.schema.defaultValue
  const exampleText =
    example === undefined
      ? t('No schema example available.')
      : /token|password|secret/i.test(sourceField?.label ?? '')
        ? t('Sensitive example redacted.')
        : template
          ? template.replace('{$value}', String(example))
          : JSON.stringify(example)
  return (
    <dialog
      ref={dialog}
      className="mapping-editor"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key !== 'Tab') return
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
            'input:not(:disabled), button:not(:disabled)',
          ),
        ]
        const focusable = controls.filter((control) => {
          if (!(control instanceof HTMLInputElement) || control.type !== 'radio') return true
          const radios = controls.filter(
            (other) =>
              other instanceof HTMLInputElement &&
              other.type === 'radio' &&
              other.name === control.name,
          ) as HTMLInputElement[]
          return control === (radios.find((radio) => radio.checked) ?? radios[0])
        })
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault()
          focusable.at(-1)?.focus()
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault()
          focusable[0]?.focus()
        }
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (validation.mapping) onApply(validation.mapping)
        }}
      >
        <header>
          <h2 id={titleId}>{t('Edit Mapping')}</h2>
          <p>{t('Select fields for this candidate. Applying creates a manual mapping.')}</p>
        </header>
        <div className="mapping-editor-columns">
          <FieldPicker
            title={t('Source response')}
            fields={catalog.sources}
            selected={source.id}
            indices={source.indices}
            onSelect={(id) => setSource({ id, indices: [] })}
            onIndex={(index, value) =>
              setSource((current) => ({
                ...current,
                indices: Array.from(
                  { length: Math.max(current.indices.length, index + 1) },
                  (_, at) => (at === index ? value : (current.indices[at] ?? '')),
                ),
              }))
            }
          />
          <FieldPicker
            title={t('Target request')}
            fields={catalog.targets}
            selected={target.id}
            indices={target.indices}
            onSelect={(id) => setTarget({ id, indices: [] })}
            onIndex={(index, value) =>
              setTarget((current) => ({
                ...current,
                indices: Array.from(
                  { length: Math.max(current.indices.length, index + 1) },
                  (_, at) => (at === index ? value : (current.indices[at] ?? '')),
                ),
              }))
            }
          />
        </div>
        <label className="mapping-transform">
          {t('Transform template (optional)')}
          <input
            value={template}
            placeholder={t('Bearer {$value}')}
            onChange={(event) => setTemplate(event.currentTarget.value)}
          />
          <small>
            {t('Use one {$value} placeholder. No scripts or expressions are executed.')}
          </small>
        </label>
        <section
          className="mapping-validation"
          aria-label={t('Mapping validation')}
          aria-live="polite"
        >
          {validation.errors.length ? (
            <ul>
              {validation.errors.map((error) => (
                <li key={error}>{localize(error)}</li>
              ))}
            </ul>
          ) : (
            <>
              <p>{t('Mapping is compatible.')}</p>
              <code>
                {selectorLabel(validation.mapping!.source)} →{' '}
                {targetLabel(validation.mapping!.target)}
              </code>
            </>
          )}
          {validation.mapping ? (
            <p>
              {t('Runtime expression preview:')}{' '}
              <code>
                {validation.mapping.transform?.raw ?? selectorLabel(validation.mapping.source)}
              </code>
            </p>
          ) : null}
          <p>{t('Example preview: {{example}}', { example: exampleText })}</p>
          <p>
            {t('Arazzo:')}{' '}
            {validation.mapping
              ? validation.mapping.target.kind === 'request-body' &&
                /\/(?:0|[1-9]\d*)(?:\/|$)/.test(validation.mapping.target.pointer)
                ? t('Array request-body targets are not supported by the current exporter.')
                : t(
                    'Supported mapping shape; workflow binding and ordering still require export validation.',
                  )
              : t('Unavailable until mapping validation passes.')}
          </p>
        </section>
        <footer className="review-dialog-buttons">
          <button type="button" onClick={onCancel}>
            {t('Cancel')}
          </button>
          <button type="submit" disabled={!validation.mapping}>
            {t('Apply mapping')}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
