import {
  appendSourcePointer,
  type EndpointFlowNode,
  type FlowValueTarget,
  type NormalizedOperation,
  type NormalizedParameter,
  type NormalizedSchema,
  type SourcePointer,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import { canonicalizeJson } from '@api-schema-flow/flow'

import type {
  InferenceConfig,
  InferenceFieldExtractionResult,
  InferenceSourceField,
  InferenceTargetField,
} from './contracts.js'
import { normalizeFieldName, resourceKeyForPath } from './name-normalization.js'

interface TraversalContext {
  readonly config: InferenceConfig
  readonly diagnostics: Diagnostic[]
  readonly operation: NormalizedOperation
  readonly sourceId: string
  readonly operationNodeId: string
  readonly resourceKey: string
}

interface SchemaLeaf {
  readonly name: string
  readonly pointer: string
  readonly schema: NormalizedSchema
  readonly sourcePointer: SourcePointer
  readonly arrayDepth: number
  readonly variant: boolean
  readonly required: boolean
}

function pointerForTokens(tokens: readonly string[]): string {
  return tokens.length === 0
    ? '#'
    : `#/${tokens.map((token) => token.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`
}

function depthDiagnostic(
  context: TraversalContext,
  schema: NormalizedSchema,
  depth: number,
): Diagnostic {
  return {
    code: DIAGNOSTIC_CODES.INFERENCE_SCHEMA_LIMIT,
    severity: 'warning',
    message: `Inference schema traversal stopped at depth ${depth}.`,
    source: schema.source,
    details: {
      operationKey: context.operation.id,
      maxSchemaDepth: context.config.maxSchemaDepth,
    },
  }
}

function traverseSchema(
  schema: NormalizedSchema,
  tokens: readonly string[],
  arrayDepth: number,
  variant: boolean,
  required: boolean,
  depth: number,
  ancestors: Set<NormalizedSchema>,
  context: TraversalContext,
  leaves: SchemaLeaf[],
): void {
  if (depth > context.config.maxSchemaDepth) {
    context.diagnostics.push(depthDiagnostic(context, schema, depth))
    return
  }
  if (ancestors.has(schema)) return
  ancestors.add(schema)

  const properties = Object.entries(schema.properties).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  if (properties.length > 0) {
    const requiredNames = new Set(schema.required)
    for (const [name, nested] of properties) {
      traverseSchema(
        nested,
        [...tokens, name],
        arrayDepth,
        variant,
        requiredNames.has(name),
        depth + 1,
        ancestors,
        context,
        leaves,
      )
    }
  } else if (schema.items !== undefined) {
    traverseSchema(
      schema.items,
      tokens,
      arrayDepth + 1,
      variant,
      required,
      depth + 1,
      ancestors,
      context,
      leaves,
    )
  } else if (tokens.length > 0) {
    leaves.push({
      name: tokens.at(-1)!,
      pointer: pointerForTokens(tokens),
      schema,
      sourcePointer: schema.source,
      arrayDepth,
      variant,
      required,
    })
  }

  for (const nested of schema.allOf) {
    traverseSchema(
      nested,
      tokens,
      arrayDepth,
      variant,
      required,
      depth + 1,
      ancestors,
      context,
      leaves,
    )
  }
  for (const nested of [...schema.oneOf, ...schema.anyOf]) {
    traverseSchema(
      nested,
      tokens,
      arrayDepth,
      true,
      required,
      depth + 1,
      ancestors,
      context,
      leaves,
    )
  }

  ancestors.delete(schema)
}

function extractLeaves(schema: NormalizedSchema, context: TraversalContext): readonly SchemaLeaf[] {
  const leaves: SchemaLeaf[] = []
  traverseSchema(schema, [], 0, false, false, 0, new Set(), context, leaves)
  const unique = new Map<string, SchemaLeaf>()
  for (const leaf of leaves) {
    const key = `${leaf.pointer}\u0000${leaf.sourcePointer.uri}\u0000${leaf.sourcePointer.pointer}\u0000${leaf.arrayDepth}\u0000${leaf.variant}`
    if (!unique.has(key)) unique.set(key, leaf)
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.pointer.localeCompare(right.pointer) ||
      left.sourcePointer.pointer.localeCompare(right.sourcePointer.pointer),
  )
}

function successResponses(operation: NormalizedOperation) {
  const explicit = operation.responses.filter(({ statusCode }) => /^2\d\d$/u.test(statusCode))
  if (explicit.length > 0) return explicit
  return operation.responses.filter(({ statusCode }) => statusCode === 'default')
}

function sourceField(
  context: TraversalContext,
  leaf: SchemaLeaf,
  statusCode: string,
): InferenceSourceField {
  return {
    sourceId: context.sourceId,
    operationNodeId: context.operationNodeId,
    operationKey: context.operation.id,
    ...(context.operation.operationId === undefined
      ? {}
      : { operationId: context.operation.operationId }),
    method: context.operation.method,
    path: context.operation.path,
    tags: [...context.operation.tags].sort(),
    name: leaf.name,
    normalizedName: normalizeFieldName(leaf.name),
    schemaTypes: [...leaf.schema.types].sort(),
    ...(leaf.schema.format === undefined ? {} : { format: leaf.schema.format }),
    sourcePointer: leaf.sourcePointer,
    resourceKey: context.resourceKey,
    readOnly: leaf.schema.readOnly,
    writeOnly: leaf.schema.writeOnly,
    required: leaf.required,
    arrayDepth: leaf.arrayDepth,
    variant: leaf.variant,
    selector: { kind: 'response-body', pointer: leaf.pointer },
    statusCode,
  }
}

function parameterTarget(parameter: NormalizedParameter): FlowValueTarget {
  switch (parameter.location) {
    case 'path':
      return { kind: 'path-parameter', name: parameter.name }
    case 'query':
      return { kind: 'query-parameter', name: parameter.name }
    case 'querystring':
      return { kind: 'querystring-parameter', name: parameter.name }
    case 'header':
      return { kind: 'header-parameter', name: parameter.name }
    case 'cookie':
      return { kind: 'cookie-parameter', name: parameter.name }
  }
}

function targetField(
  context: TraversalContext,
  options: {
    readonly name: string
    readonly target: FlowValueTarget
    readonly schema?: NormalizedSchema
    readonly sourcePointer: SourcePointer
    readonly required: boolean
    readonly arrayDepth?: number
    readonly variant?: boolean
    readonly securityTarget?: boolean
    readonly bearerTarget?: boolean
  },
): InferenceTargetField {
  return {
    sourceId: context.sourceId,
    operationNodeId: context.operationNodeId,
    operationKey: context.operation.id,
    ...(context.operation.operationId === undefined
      ? {}
      : { operationId: context.operation.operationId }),
    method: context.operation.method,
    path: context.operation.path,
    tags: [...context.operation.tags].sort(),
    name: options.name,
    normalizedName: normalizeFieldName(options.name),
    schemaTypes: [...(options.schema?.types ?? ['string'])].sort(),
    ...(options.schema?.format === undefined ? {} : { format: options.schema.format }),
    sourcePointer: options.sourcePointer,
    resourceKey: context.resourceKey,
    readOnly: options.schema?.readOnly ?? false,
    writeOnly: options.schema?.writeOnly ?? false,
    required: options.required,
    arrayDepth: options.arrayDepth ?? 0,
    variant: options.variant ?? false,
    target: options.target,
    securityTarget: options.securityTarget ?? false,
    bearerTarget: options.bearerTarget ?? false,
  }
}

export function extractOperationSourceFields(
  sourceId: string,
  node: EndpointFlowNode,
  operation: NormalizedOperation,
  config: InferenceConfig,
): InferenceFieldExtractionResult<InferenceSourceField> {
  const diagnostics: Diagnostic[] = []
  const context: TraversalContext = {
    config,
    diagnostics,
    operation,
    sourceId,
    operationNodeId: node.id,
    resourceKey: resourceKeyForPath(operation.path),
  }
  const fields: InferenceSourceField[] = []
  for (const response of successResponses(operation)) {
    for (const media of response.content) {
      if (media.schema === undefined) continue
      for (const leaf of extractLeaves(media.schema, context)) {
        fields.push(sourceField(context, leaf, response.statusCode))
      }
    }
  }
  return {
    fields: fields.sort(
      (left, right) =>
        left.operationNodeId.localeCompare(right.operationNodeId) ||
        canonicalizeJson(left.selector).localeCompare(canonicalizeJson(right.selector)),
    ),
    diagnostics: sortDiagnostics(diagnostics),
  }
}

function requestBodyTarget(context: TraversalContext, leaf: SchemaLeaf): InferenceTargetField {
  return targetField(context, {
    name: leaf.name,
    target: { kind: 'request-body', pointer: leaf.pointer },
    schema: leaf.schema,
    sourcePointer: leaf.sourcePointer,
    required: leaf.required,
    arrayDepth: leaf.arrayDepth,
    variant: leaf.variant,
  })
}

function isBearerSecurityName(name: string): boolean {
  return /bearer|oauth|jwt|token/iu.test(name)
}

export function extractOperationTargetFields(
  sourceId: string,
  node: EndpointFlowNode,
  operation: NormalizedOperation,
  config: InferenceConfig,
): InferenceFieldExtractionResult<InferenceTargetField> {
  const diagnostics: Diagnostic[] = []
  const context: TraversalContext = {
    config,
    diagnostics,
    operation,
    sourceId,
    operationNodeId: node.id,
    resourceKey: resourceKeyForPath(operation.path),
  }
  const fields = operation.parameters.map((parameter) =>
    targetField(context, {
      name: parameter.name,
      target: parameterTarget(parameter),
      ...(parameter.schema === undefined ? {} : { schema: parameter.schema }),
      sourcePointer: parameter.source,
      required: parameter.required,
      securityTarget:
        parameter.location === 'header' &&
        parameter.name.toLocaleLowerCase('en-US') === 'authorization',
      bearerTarget:
        parameter.location === 'header' &&
        parameter.name.toLocaleLowerCase('en-US') === 'authorization',
    }),
  )

  if (operation.requestBody !== undefined) {
    for (const media of operation.requestBody.content) {
      if (media.schema === undefined) continue
      fields.push(
        ...extractLeaves(media.schema, context).map((leaf) => requestBodyTarget(context, leaf)),
      )
    }
  }

  const bearerRequirements = operation.security.filter(({ scheme }) => isBearerSecurityName(scheme))
  if (bearerRequirements.length > 0) {
    fields.push(
      targetField(context, {
        name: 'Authorization',
        target: { kind: 'header-parameter', name: 'Authorization' },
        sourcePointer: appendSourcePointer(operation.source, ['security']),
        required: true,
        securityTarget: true,
        bearerTarget: true,
      }),
    )
  }

  const unique = new Map<string, InferenceTargetField>()
  for (const field of fields) {
    const key = `${field.operationNodeId}\u0000${JSON.stringify(field.target)}`
    if (!unique.has(key)) unique.set(key, field)
  }
  return {
    fields: [...unique.values()].sort(
      (left, right) =>
        left.operationNodeId.localeCompare(right.operationNodeId) ||
        JSON.stringify(left.target).localeCompare(JSON.stringify(right.target)),
    ),
    diagnostics: sortDiagnostics(diagnostics),
  }
}
