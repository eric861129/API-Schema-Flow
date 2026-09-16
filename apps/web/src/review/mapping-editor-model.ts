import type {
  FlowDataMapping,
  FlowValueSelector,
  FlowValueTarget,
  InferenceCandidate,
  NormalizedSchema,
} from '@api-schema-flow/domain'
import type { WorkspaceSnapshot } from '../data/types'
import { createSchemaResolver, expandSchema } from './review-workspace-adapter'

/** 可選欄位保留結構來源及陣列所在位置，不把顯示文字當作映射。 */
export interface MappingField<T> {
  readonly id: string
  readonly label: string
  readonly value: T
  readonly schema: NormalizedSchema
  readonly required: boolean
  readonly arraySlots: readonly number[]
  readonly unavailable?: string
}

export interface MappingCatalog {
  readonly sources: readonly MappingField<FlowValueSelector>[]
  readonly targets: readonly MappingField<FlowValueTarget>[]
}

const escapeToken = (token: string) => token.replaceAll('~', '~0').replaceAll('/', '~1')
const pointerFor = (tokens: readonly string[]) =>
  '#' + tokens.map((token) => '/' + escapeToken(token)).join('')

/** 只列出能由既有映射模型表示的欄位；遞迴與聯集不猜測分支。 */
export function createMappingCatalog(
  snapshot: WorkspaceSnapshot,
  candidate: InferenceCandidate,
): MappingCatalog {
  const resolve = createSchemaResolver(snapshot.apiDocument)
  function fields<T>(
    schema: NormalizedSchema,
    makeValue: (pointer: string) => T,
    prefix: string,
    required: boolean,
  ): MappingField<T>[] {
    const result: MappingField<T>[] = []
    function walk(
      current: NormalizedSchema,
      tokens: readonly string[],
      slots: readonly number[],
      isRequired: boolean,
      ancestors: ReadonlySet<NormalizedSchema>,
      inheritedBlock?: string,
      nullableAncestor = false,
    ) {
      if (ancestors.has(current) || tokens.length > 16 || result.length >= 1000) return
      const next = new Set([...ancestors, current])
      const variants = expandSchema(current, resolve)
      if (variants.some((variant) => variant.oneOf.length || variant.anyOf.length)) {
        const value = makeValue(pointerFor(tokens))
        result.push({
          id: JSON.stringify(value),
          label: prefix + pointerFor(tokens),
          value,
          schema: current,
          required: isRequired,
          arraySlots: slots,
          unavailable: 'Ambiguous schema variants cannot be edited.',
        })
        return
      }
      const unavailable =
        inheritedBlock ??
        (variants.some((item) => (prefix === 'Response ' ? item.writeOnly : item.readOnly))
          ? prefix === 'Response '
            ? 'Write-only fields are not response values.'
            : 'Read-only fields cannot be request targets.'
          : undefined)
      const nullable =
        nullableAncestor || variants.some((item) => item.nullable || item.types.includes('null'))
      for (const variant of variants) {
        if (variant.items)
          walk(
            variant.items,
            [...tokens, '*'],
            [...slots, tokens.length],
            isRequired,
            next,
            unavailable,
            nullable,
          )
        for (const [name, child] of Object.entries(variant.properties).sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          walk(
            child,
            [...tokens, name],
            slots,
            isRequired && variant.required.includes(name),
            next,
            unavailable,
            nullable,
          )
        }
        if (
          !variant.types.some((type) => ['string', 'number', 'integer', 'boolean'].includes(type))
        )
          continue
        const value = makeValue(pointerFor(tokens))
        result.push({
          id: JSON.stringify(value),
          label: prefix + pointerFor(tokens),
          value,
          schema: prefix === 'Response ' && nullable ? { ...variant, nullable: true } : variant,
          required: isRequired,
          arraySlots: slots,
          ...(unavailable ? { unavailable } : {}),
        })
      }
    }
    walk(schema, [], [], required, new Set())
    return result
  }
  const source = snapshot.apiDocument.operations.find(
    (item) => item.id === candidate.sourceOperationKey,
  )
  const target = snapshot.apiDocument.operations.find(
    (item) => item.id === candidate.targetOperationKey,
  )
  const responses = source?.responses.filter((item) => /^2\d\d$/.test(item.statusCode)) ?? []
  const successful = responses.length
    ? responses
    : (source?.responses.filter((item) => item.statusCode === 'default') ?? [])
  const sources = successful.flatMap((response) =>
    response.content.flatMap((media) =>
      media.schema
        ? fields<FlowValueSelector>(
            media.schema,
            (pointer) => ({ kind: 'response-body', pointer }),
            'Response ',
            true,
          )
        : [],
    ),
  )
  const targets: MappingField<FlowValueTarget>[] = (target?.parameters ?? []).flatMap(
    (parameter) => {
      if (!parameter.schema || !['path', 'query', 'header'].includes(parameter.location)) return []
      const kind =
        parameter.location === 'path'
          ? 'path-parameter'
          : parameter.location === 'query'
            ? 'query-parameter'
            : 'header-parameter'
      const value: FlowValueTarget = { kind, name: parameter.name }
      return fields<FlowValueTarget>(
        parameter.schema,
        () => value,
        `${parameter.location}.${parameter.name}`,
        parameter.required,
      ).map((field) => ({
        ...field,
        label: `${parameter.location}.${parameter.name}`,
        ...(field.arraySlots.length || field.label !== `${parameter.location}.${parameter.name}#`
          ? { unavailable: 'Only scalar parameter mappings are supported.' }
          : {}),
      }))
    },
  )
  for (const media of target?.requestBody?.content ?? []) {
    if (media.schema)
      targets.push(
        ...fields<FlowValueTarget>(
          media.schema,
          (pointer) => ({ kind: 'request-body', pointer }),
          'Body ',
          target?.requestBody?.required ?? false,
        ),
      )
  }
  function unique<T>(values: MappingField<T>[]): MappingField<T>[] {
    const byId = new Map<string, MappingField<T>>()
    const signature = (field: MappingField<T>) =>
      JSON.stringify([
        field.schema.types,
        field.schema.format,
        field.schema.enumValues,
        field.schema.nullable,
        field.required,
        field.unavailable,
      ])
    for (const field of values) {
      const existing = byId.get(field.id)
      byId.set(
        field.id,
        existing && signature(existing) !== signature(field)
          ? { ...existing, unavailable: 'Ambiguous schema variants cannot be edited.' }
          : (existing ?? field),
      )
    }
    return [...byId.values()]
  }
  return { sources: unique(sources), targets: unique(targets) }
}

/** 將使用者明確輸入的陣列索引轉為 JSON Pointer，絕不預設第一筆。 */
export function selectMappingValue<T extends FlowValueSelector | FlowValueTarget>(
  field: MappingField<T>,
  indices: readonly string[],
): T | undefined {
  if (!field.arraySlots.length) return field.value
  if (
    !('pointer' in field.value) ||
    field.arraySlots.some(
      (_, index) =>
        !/^(0|[1-9]\d*)$/.test(indices[index] ?? '') ||
        !Number.isSafeInteger(Number(indices[index])),
    )
  )
    return undefined
  const tokens = field.value.pointer.slice(2).split('/')
  field.arraySlots.forEach((position, index) => {
    tokens[position] = indices[index]!
  })
  return { ...field.value, pointer: '#/' + tokens.join('/') }
}

export interface MappingEditInput {
  readonly sourceId: string
  readonly targetId: string
  readonly sourceIndices: readonly string[]
  readonly targetIndices: readonly string[]
  readonly template: string
}

/** 重新驗證既有草稿，避免其他呼叫端繞過介面驗證。 */
export function validateEditedMapping(
  snapshot: WorkspaceSnapshot,
  candidate: InferenceCandidate,
  mapping: FlowDataMapping,
): readonly string[] {
  const catalog = createMappingCatalog(snapshot, candidate)
  const source = initialFieldSelection(catalog.sources, mapping.source)
  const target = initialFieldSelection(catalog.targets, mapping.target)
  return validateMappingEdit(catalog, {
    sourceId: source.id,
    targetId: target.id,
    sourceIndices: source.indices,
    targetIndices: target.indices,
    template: mapping.transform?.raw.replace(/\{\$[^}]+\}/g, '{$value}') ?? '',
  }).errors
}

/** 套用前以可信欄位目錄驗證，避免任意指標或未支援轉換進入草稿。 */
export function validateMappingEdit(
  catalog: MappingCatalog,
  input: MappingEditInput,
): { readonly errors: readonly string[]; readonly mapping?: FlowDataMapping } {
  const source = catalog.sources.find((field) => field.id === input.sourceId)
  const target = catalog.targets.find((field) => field.id === input.targetId)
  if (!source || !target) return { errors: ['Choose a source and target field.'] }
  const errors: string[] = []
  for (const field of [source, target]) if (field.unavailable) errors.push(field.unavailable)
  const sourceValue = selectMappingValue(source, input.sourceIndices)
  const targetValue = selectMappingValue(target, input.targetIndices)
  if (!sourceValue || !targetValue)
    errors.push('Enter an explicit non-negative integer for every array index.')
  const sourceTypes = source.schema.types.filter((type) => type !== 'null')
  const targetTypes = target.schema.types.filter((type) => type !== 'null')
  if (
    sourceTypes.length !== 1 ||
    targetTypes.length !== 1 ||
    !['string', 'integer', 'number', 'boolean'].includes(sourceTypes[0]!) ||
    !['string', 'integer', 'number', 'boolean'].includes(targetTypes[0]!)
  )
    errors.push('Schema type is incomplete or unsupported.')
  const template = input.template.trim()
  if (
    template &&
    (template.split('{$value}').length !== 2 || /[{}$]/.test(template.replace('{$value}', '')))
  )
    errors.push('Use exactly one {$value} placeholder and literal text only.')
  const outputType = template ? 'string' : sourceTypes[0]
  if (outputType !== targetTypes[0] && !(outputType === 'integer' && targetTypes[0] === 'number'))
    errors.push('Source and target types are incompatible.')
  if (
    (source.schema.nullable || source.schema.types.includes('null')) &&
    !(target.schema.nullable || target.schema.types.includes('null'))
  )
    errors.push('Nullable source cannot supply a non-null target.')
  if (target.required && !source.required)
    errors.push('Optional source cannot guarantee a required target value.')
  if (target.schema.format && (template || target.schema.format !== source.schema.format))
    errors.push('Target format is not guaranteed by the source.')
  if (
    target.schema.enumValues.length &&
    (template ||
      !source.schema.enumValues.length ||
      source.schema.enumValues.some((value) => !target.schema.enumValues.includes(value)))
  )
    errors.push('Source values are not guaranteed to satisfy the target enum.')
  if (
    /(token|password|secret)/i.test(source.label) &&
    !(targetValue?.kind === 'header-parameter' && /^authorization$/i.test(targetValue.name))
  )
    errors.push('Sensitive values may only map to the Authorization header.')
  if (errors.length || !sourceValue || !targetValue) return { errors: [...new Set(errors)] }
  return {
    errors: [],
    mapping: {
      id: 'mapping:editor-draft',
      source: sourceValue,
      target: targetValue,
      aliases: [],
      ...(template
        ? {
            transform: {
              kind: 'template',
              raw: template.replace('{$value}', '{$steps.source.outputs.value}'),
            } as const,
          }
        : {}),
      sourcePointers: [source.schema.source, target.schema.source],
    },
  }
}

export function initialFieldSelection<T extends FlowValueSelector | FlowValueTarget>(
  fields: readonly MappingField<T>[],
  value: T,
): { id: string; indices: string[] } {
  for (const field of fields) {
    if (field.value.kind !== value.kind) continue
    if ('pointer' in value && 'pointer' in field.value) {
      const actual = value.pointer.slice(2).split('/')
      const pattern = field.value.pointer.slice(2).split('/')
      if (
        actual.length === pattern.length &&
        pattern.every((token, index) =>
          field.arraySlots.includes(index)
            ? /^(0|[1-9]\d*)$/.test(actual[index]!)
            : token === actual[index],
        )
      )
        return { id: field.id, indices: field.arraySlots.map((index) => actual[index]!) }
    } else if (JSON.stringify(field.value) === JSON.stringify(value))
      return { id: field.id, indices: [] }
  }
  return { id: '', indices: [] }
}
