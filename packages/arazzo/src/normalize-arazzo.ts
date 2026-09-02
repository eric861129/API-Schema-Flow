import type { SourcePointer } from '@api-schema-flow/domain'
import { sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'

import type {
  ArazzoOperationTarget,
  ArazzoPreservedObject,
  NormalizedArazzoAction,
  NormalizedArazzoCriterion,
  NormalizedArazzoDocument,
  NormalizedArazzoInfo,
  NormalizedArazzoParameter,
  NormalizedArazzoRequestBody,
  NormalizedArazzoSourceDescription,
  NormalizedArazzoStep,
  NormalizedArazzoValue,
  NormalizedArazzoWorkflow,
} from './model.js'
import { isRecord, stringValue, type UnknownRecord } from './object-utils.js'
import {
  clonePreservedValue,
  normalizeArazzoValue,
  type NormalizeArazzoValueOptions,
} from './normalize-value.js'
import { arazzoChildSource, arazzoRootSource } from './source-pointer.js'
import { detectArazzoVersion } from './version.js'

export interface NormalizeArazzoResult {
  readonly document?: NormalizedArazzoDocument
  readonly diagnostics: readonly Diagnostic[]
}

interface NormalizationContext {
  readonly diagnostics: Diagnostic[]
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function splitPreservedFields(
  input: UnknownRecord,
  knownFields: ReadonlySet<string>,
): Pick<ArazzoPreservedObject, 'extensions' | 'preservedFields'> {
  const extensions: Record<string, unknown> = {}
  const preservedFields: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (knownFields.has(key)) continue
    if (key.startsWith('x-')) extensions[key] = clonePreservedValue(value)
    else preservedFields[key] = clonePreservedValue(value)
  }

  return { extensions, preservedFields }
}

function normalizeValue(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
  options: NormalizeArazzoValueOptions = {},
): NormalizedArazzoValue {
  const normalized = normalizeArazzoValue(input, source, options)
  context.diagnostics.push(...normalized.diagnostics)
  return normalized.value
}

function normalizeValueMap(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): Readonly<Record<string, NormalizedArazzoValue>> {
  if (!isRecord(input)) return {}

  const values: Record<string, NormalizedArazzoValue> = {}
  for (const [name, value] of Object.entries(input).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    values[name] = normalizeValue(value, arazzoChildSource(source, name), context)
  }
  return values
}

function normalizeInfo(input: unknown, source: SourcePointer): NormalizedArazzoInfo {
  const value = isRecord(input) ? input : {}
  const summary = stringValue(value.summary)
  const description = stringValue(value.description)
  return {
    title: stringValue(value.title) ?? '',
    version: stringValue(value.version) ?? '',
    ...(summary === undefined ? {} : { summary }),
    ...(description === undefined ? {} : { description }),
    source,
    ...splitPreservedFields(value, new Set(['title', 'version', 'summary', 'description'])),
  }
}

function normalizeSourceDescriptions(
  input: unknown,
  source: SourcePointer,
): readonly NormalizedArazzoSourceDescription[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry, index) => {
    if (!isRecord(entry)) return []
    const itemSource = arazzoChildSource(source, String(index))
    return [
      {
        name: stringValue(entry.name) ?? '',
        url: stringValue(entry.url) ?? '',
        type: stringValue(entry.type) ?? '',
        source: itemSource,
        ...splitPreservedFields(entry, new Set(['name', 'url', 'type'])),
      },
    ]
  })
}

function normalizeParameter(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): NormalizedArazzoParameter | undefined {
  if (!isRecord(input)) return undefined
  const description = stringValue(input.description)
  return {
    name: stringValue(input.name) ?? '',
    location: stringValue(input.in) ?? stringValue(input.location) ?? '',
    value: normalizeValue(input.value, arazzoChildSource(source, 'value'), context),
    ...(description === undefined ? {} : { description }),
    source,
    ...splitPreservedFields(input, new Set(['name', 'in', 'location', 'value', 'description'])),
  }
}

function normalizeParameters(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): readonly NormalizedArazzoParameter[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry, index) => {
    const normalized = normalizeParameter(entry, arazzoChildSource(source, String(index)), context)
    return normalized ? [normalized] : []
  })
}

function normalizeRequestBody(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): NormalizedArazzoRequestBody | undefined {
  if (!isRecord(input)) return undefined
  const contentType = stringValue(input.contentType)
  return {
    ...(contentType === undefined ? {} : { contentType }),
    payload: normalizeValue(input.payload, arazzoChildSource(source, 'payload'), context),
    source,
    ...splitPreservedFields(input, new Set(['contentType', 'payload'])),
  }
}

function normalizeCriterion(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): NormalizedArazzoCriterion | undefined {
  if (!isRecord(input)) return undefined
  const type = stringValue(input.type)
  const criterionContext = stringValue(input.context)
  return {
    condition: normalizeValue(input.condition, arazzoChildSource(source, 'condition'), context, {
      parseRuntimeExpressions: false,
    }),
    ...(type === undefined ? {} : { type }),
    ...(criterionContext === undefined ? {} : { context: criterionContext }),
    source,
    ...splitPreservedFields(input, new Set(['condition', 'type', 'context'])),
  }
}

function normalizeCriteria(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): readonly NormalizedArazzoCriterion[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry, index) => {
    const normalized = normalizeCriterion(entry, arazzoChildSource(source, String(index)), context)
    return normalized ? [normalized] : []
  })
}

function normalizeAction(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): NormalizedArazzoAction | undefined {
  if (!isRecord(input)) return undefined
  const name = stringValue(input.name)
  const type = stringValue(input.type)
  const stepId = stringValue(input.stepId)
  const workflowId = stringValue(input.workflowId)
  const retry = numberValue(input.retry)
  return {
    ...(name === undefined ? {} : { name }),
    ...(type === undefined ? {} : { type }),
    ...(stepId === undefined ? {} : { stepId }),
    ...(workflowId === undefined ? {} : { workflowId }),
    ...(retry === undefined ? {} : { retry }),
    criteria: normalizeCriteria(input.criteria, arazzoChildSource(source, 'criteria'), context),
    source,
    ...splitPreservedFields(
      input,
      new Set(['name', 'type', 'stepId', 'workflowId', 'retry', 'criteria']),
    ),
  }
}

function normalizeActions(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): readonly NormalizedArazzoAction[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry, index) => {
    const normalized = normalizeAction(entry, arazzoChildSource(source, String(index)), context)
    return normalized ? [normalized] : []
  })
}

function normalizeTargets(input: UnknownRecord): readonly ArazzoOperationTarget[] {
  const targets: ArazzoOperationTarget[] = []
  const operationId = stringValue(input.operationId)
  const operationPath = stringValue(input.operationPath)
  const workflowId = stringValue(input.workflowId)
  const channelPath = stringValue(input.channelPath)
  if (operationId !== undefined) targets.push({ type: 'operationId', operationId })
  if (operationPath !== undefined) targets.push({ type: 'operationPath', operationPath })
  if (workflowId !== undefined) targets.push({ type: 'workflowId', workflowId })
  if (channelPath !== undefined) targets.push({ type: 'channelPath', channelPath })
  return targets
}

function normalizeStep(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): NormalizedArazzoStep | undefined {
  if (!isRecord(input)) return undefined
  const description = stringValue(input.description)
  const timeout = numberValue(input.timeout)
  const requestBody = normalizeRequestBody(
    input.requestBody,
    arazzoChildSource(source, 'requestBody'),
    context,
  )
  return {
    stepId: stringValue(input.stepId) ?? '',
    ...(description === undefined ? {} : { description }),
    targets: normalizeTargets(input),
    parameters: normalizeParameters(
      input.parameters,
      arazzoChildSource(source, 'parameters'),
      context,
    ),
    ...(requestBody === undefined ? {} : { requestBody }),
    successCriteria: normalizeCriteria(
      input.successCriteria,
      arazzoChildSource(source, 'successCriteria'),
      context,
    ),
    onSuccess: normalizeActions(input.onSuccess, arazzoChildSource(source, 'onSuccess'), context),
    onFailure: normalizeActions(input.onFailure, arazzoChildSource(source, 'onFailure'), context),
    outputs: normalizeValueMap(input.outputs, arazzoChildSource(source, 'outputs'), context),
    dependsOn: [...new Set(stringArray(input.dependsOn))],
    ...(timeout === undefined ? {} : { timeout }),
    source,
    ...splitPreservedFields(
      input,
      new Set([
        'stepId',
        'description',
        'operationId',
        'operationPath',
        'workflowId',
        'channelPath',
        'parameters',
        'requestBody',
        'successCriteria',
        'onSuccess',
        'onFailure',
        'outputs',
        'dependsOn',
        'timeout',
      ]),
    ),
  }
}

function normalizeSteps(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): readonly NormalizedArazzoStep[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry, index) => {
    const normalized = normalizeStep(entry, arazzoChildSource(source, String(index)), context)
    return normalized ? [normalized] : []
  })
}

function normalizeWorkflow(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): NormalizedArazzoWorkflow | undefined {
  if (!isRecord(input)) return undefined
  const summary = stringValue(input.summary)
  const description = stringValue(input.description)
  const inputs = Object.hasOwn(input, 'inputs')
    ? normalizeValue(input.inputs, arazzoChildSource(source, 'inputs'), context)
    : undefined
  return {
    workflowId: stringValue(input.workflowId) ?? '',
    ...(summary === undefined ? {} : { summary }),
    ...(description === undefined ? {} : { description }),
    ...(inputs === undefined ? {} : { inputs }),
    parameters: normalizeParameters(
      input.parameters,
      arazzoChildSource(source, 'parameters'),
      context,
    ),
    steps: normalizeSteps(input.steps, arazzoChildSource(source, 'steps'), context),
    successActions: normalizeActions(
      input.successActions,
      arazzoChildSource(source, 'successActions'),
      context,
    ),
    failureActions: normalizeActions(
      input.failureActions,
      arazzoChildSource(source, 'failureActions'),
      context,
    ),
    outputs: normalizeValueMap(input.outputs, arazzoChildSource(source, 'outputs'), context),
    source,
    ...splitPreservedFields(
      input,
      new Set([
        'workflowId',
        'summary',
        'description',
        'inputs',
        'parameters',
        'steps',
        'successActions',
        'failureActions',
        'outputs',
      ]),
    ),
  }
}

function normalizeWorkflows(
  input: unknown,
  source: SourcePointer,
  context: NormalizationContext,
): readonly NormalizedArazzoWorkflow[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((entry, index) => {
    const normalized = normalizeWorkflow(entry, arazzoChildSource(source, String(index)), context)
    return normalized ? [normalized] : []
  })
}

export function normalizeArazzoDocument(
  input: unknown,
  source: SourceDocument,
): NormalizeArazzoResult {
  const version = detectArazzoVersion(input, source.uri)
  if (!version.version || !isRecord(input)) {
    return { diagnostics: sortDiagnostics(version.diagnostics) }
  }

  const context: NormalizationContext = {
    diagnostics: [...version.diagnostics],
  }
  const rootSource = arazzoRootSource(source.uri)
  const self = stringValue(input.$self)
  const document: NormalizedArazzoDocument = {
    schemaVersion: '1.0',
    sourceUri: source.uri,
    arazzoVersion: version.version,
    ...(self === undefined ? {} : { self }),
    info: normalizeInfo(input.info, arazzoChildSource(rootSource, 'info')),
    sourceDescriptions: normalizeSourceDescriptions(
      input.sourceDescriptions,
      arazzoChildSource(rootSource, 'sourceDescriptions'),
    ),
    workflows: normalizeWorkflows(
      input.workflows,
      arazzoChildSource(rootSource, 'workflows'),
      context,
    ),
    components: normalizeValue(
      input.components ?? {},
      arazzoChildSource(rootSource, 'components'),
      context,
    ),
    source: rootSource,
    ...splitPreservedFields(
      input,
      new Set(['arazzo', '$self', 'info', 'sourceDescriptions', 'workflows', 'components']),
    ),
  }

  return {
    document,
    diagnostics: sortDiagnostics(context.diagnostics),
  }
}
