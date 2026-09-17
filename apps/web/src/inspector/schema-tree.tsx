import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { NormalizedSchema, SourcePointer } from '@api-schema-flow/domain'

type ResolveSchema = (pointer: SourcePointer) => NormalizedSchema | undefined

interface SchemaShape {
  readonly parts: readonly NormalizedSchema[]
  readonly properties: ReadonlyMap<string, NormalizedSchema>
  readonly required: ReadonlySet<string>
  readonly items?: NormalizedSchema
  readonly variants: readonly { readonly label: string; readonly schema: NormalizedSchema }[]
}

/** 僅合併參照與 allOf；oneOf／anyOf 保持為獨立分支，避免誤標必填欄位。 */
function describeSchema(schema: NormalizedSchema, resolve: ResolveSchema): SchemaShape {
  const parts: NormalizedSchema[] = []
  const seen = new Set<NormalizedSchema>()
  function visit(current: NormalizedSchema) {
    if (seen.has(current)) return
    seen.add(current)
    parts.push(current)
    if (current.resolvedRef) {
      const referenced = resolve(current.resolvedRef)
      if (referenced) visit(referenced)
    }
    current.allOf.forEach(visit)
  }
  visit(schema)
  const properties = new Map<string, NormalizedSchema>()
  const required = new Set<string>()
  const variants: { label: string; schema: NormalizedSchema }[] = []
  for (const part of parts) {
    for (const [name, field] of Object.entries(part.properties)) properties.set(name, field)
    part.required.forEach((name) => required.add(name))
    part.oneOf.forEach((item, index) =>
      variants.push({ label: `oneOf ${index + 1}`, schema: item }),
    )
    part.anyOf.forEach((item, index) =>
      variants.push({ label: `anyOf ${index + 1}`, schema: item }),
    )
  }
  return {
    parts,
    properties,
    required,
    variants,
    ...(parts.find((part) => part.items)?.items
      ? { items: parts.find((part) => part.items)!.items }
      : {}),
  }
}

function SchemaField({
  name,
  schema,
  required,
  resolve,
  ancestors,
}: {
  readonly name: string
  readonly schema: NormalizedSchema
  readonly required: boolean
  readonly resolve: ResolveSchema
  readonly ancestors: ReadonlySet<string>
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const shape = describeSchema(schema, resolve)
  const types = [...new Set(shape.parts.flatMap((part) => part.types))]
  const format = shape.parts.find((part) => part.format)?.format
  const nullable = shape.parts.some((part) => part.nullable)
  const readOnly = shape.parts.some((part) => part.readOnly)
  const writeOnly = shape.parts.some((part) => part.writeOnly)
  const description = shape.parts.find((part) => part.description)?.description
  const recursiveKey = schema.resolvedRef
    ? `${schema.resolvedRef.uri}#${schema.resolvedRef.pointer}`
    : `${schema.source.uri}#${schema.source.pointer}`
  const recursive = ancestors.has(recursiveKey)
  const children = [
    ...[...shape.properties].map(([field, value]) => ({
      name: field,
      schema: value,
      required: shape.required.has(field),
    })),
    ...(shape.items ? [{ name: '[]', schema: shape.items, required: false }] : []),
    ...shape.variants.map((variant) => ({ ...variant, name: variant.label, required: false })),
  ]
  const expandable = !recursive && children.length > 0 && ancestors.size < 12
  const nextAncestors = new Set([...ancestors, recursiveKey])
  return (
    <li className="schema-field">
      <div className="schema-field__heading">
        {expandable ? (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {name}
          </button>
        ) : (
          <strong>{name}</strong>
        )}
        <code>
          {types.join(' | ') || (shape.properties.size ? 'object' : t('unknown'))}
          {format ? ` · ${format}` : ''}
        </code>
        {required ? <small>{t('Required')}</small> : null}
      </div>
      {nullable || readOnly || writeOnly || recursive ? (
        <div className="schema-field__flags">
          {nullable ? <span>{t('Nullable')}</span> : null}
          {readOnly ? <span>{t('Read only')}</span> : null}
          {writeOnly ? <span>{t('Write only')}</span> : null}
          {recursive ? <span>{t('Recursive reference')}</span> : null}
        </div>
      ) : null}
      {description ? <p>{description}</p> : null}
      {expanded ? (
        <ul>
          {children.map((child) => (
            <SchemaField key={child.name} {...child} resolve={resolve} ancestors={nextAncestors} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function SchemaTree({
  schema,
  resolve,
}: {
  readonly schema: NormalizedSchema | undefined
  readonly resolve: ResolveSchema
}) {
  const { t } = useTranslation()
  if (!schema) return <p className="muted">{t('No schema declared')}</p>
  return (
    <ul className="schema-tree" aria-label={t('Schema fields')}>
      <SchemaField
        name={t('Body')}
        schema={schema}
        required={false}
        resolve={resolve}
        ancestors={new Set()}
      />
    </ul>
  )
}
