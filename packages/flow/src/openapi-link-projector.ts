import { parseRuntimeExpression, parseRuntimeTemplate } from '@api-schema-flow/arazzo'
import {
  ACCEPTED_FLOW_STATUS,
  DECLARED_FLOW_PROVENANCE,
  appendSourcePointer,
  escapeJsonPointerToken,
  type EndpointFlowNode,
  type FlowDataMapping,
  type FlowEdge,
  type FlowValueSelector,
  type FlowValueTransform,
  type NormalizedLink,
  type NormalizedOperation,
  type SourcePointer,
  type SourceStandardRef,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import { createEdgeId, createEndpointNodeId, createMappingId } from './canonical.js'
import type { FlowOpenApiSource, FlowProjectionFragment } from './contracts.js'
import { runtimeExpressionToSelector } from './expression-selector.js'
import { matchingLinkParameterTargets, resolveLinkParameterTarget } from './target-parameter.js'

interface MappingBucket {
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly mappings: FlowDataMapping[]
  readonly sourceStandardRefs: SourceStandardRef[]
}

interface ProjectedExpression {
  readonly selector?: FlowValueSelector
  readonly transform?: FlowValueTransform
  readonly diagnostic?: Diagnostic
}

function endpointNode(source: FlowOpenApiSource, operation: NormalizedOperation): EndpointFlowNode {
  return {
    kind: 'endpoint',
    id: createEndpointNodeId(source.sourceId, operation.id),
    sourceId: source.sourceId,
    operationKey: operation.id,
    method: operation.method,
    path: operation.path,
    ...(operation.operationId === undefined ? {} : { operationId: operation.operationId }),
    ...(operation.summary === undefined ? {} : { summary: operation.summary }),
    source: operation.source,
  }
}

function flowMappingDiagnostic(
  message: string,
  source: SourcePointer,
  details: Record<string, unknown>,
): Diagnostic {
  return {
    code: DIAGNOSTIC_CODES.FLOW_DATA_MAPPING_INVALID,
    severity: 'error',
    message,
    source,
    details,
  }
}

function projectExpression(raw: string, source: SourcePointer): ProjectedExpression {
  const parsed = parseRuntimeExpression(raw, source)
  if (parsed.expression === undefined) {
    return {
      diagnostic: flowMappingDiagnostic(
        `OpenAPI Link expression "${raw}" is not a supported Runtime Expression.`,
        source,
        { expression: raw },
      ),
    }
  }
  const selector = runtimeExpressionToSelector(parsed.expression)
  if (selector === undefined) {
    return {
      diagnostic: flowMappingDiagnostic(
        `OpenAPI Link expression "${raw}" cannot be represented as a structural selector.`,
        source,
        { expression: raw, expressionKind: parsed.expression.kind },
      ),
    }
  }
  return { selector }
}

function projectTemplate(raw: string, source: SourcePointer): ProjectedExpression {
  const parsed = parseRuntimeTemplate(raw, source)
  if (parsed.expression !== undefined) {
    const selector = runtimeExpressionToSelector(parsed.expression)
    return selector === undefined
      ? {
          diagnostic: flowMappingDiagnostic(
            `OpenAPI Link expression "${raw}" cannot be represented as a structural selector.`,
            source,
            { expression: raw, expressionKind: parsed.expression.kind },
          ),
        }
      : { selector }
  }

  if (parsed.template === undefined) {
    return {
      diagnostic: flowMappingDiagnostic(
        `OpenAPI Link request-body value "${raw}" is not a valid Runtime Expression template.`,
        source,
        { expression: raw },
      ),
    }
  }

  const expressions = parsed.template.segments.flatMap((segment) =>
    segment.kind === 'expression' ? [segment.expression] : [],
  )
  if (expressions.length === 0) return {}
  if (expressions.length !== 1) {
    return {
      diagnostic: flowMappingDiagnostic(
        'OpenAPI Link request-body templates must contain exactly one supported expression.',
        source,
        { expression: raw, expressionCount: expressions.length },
      ),
    }
  }
  const selector = runtimeExpressionToSelector(expressions[0]!)
  return selector === undefined
    ? {
        diagnostic: flowMappingDiagnostic(
          `OpenAPI Link request-body template "${raw}" cannot be represented as a structural selector.`,
          source,
          { expression: raw, expressionKind: expressions[0]!.kind },
        ),
      }
    : {
        selector,
        transform: { kind: 'template', raw },
      }
}

function mapping(
  source: FlowValueSelector,
  target: FlowDataMapping['target'],
  sourcePointer: SourcePointer,
  transform?: FlowValueTransform,
): FlowDataMapping {
  return {
    id: createMappingId(source, target, transform),
    source,
    target,
    aliases: [],
    ...(transform === undefined ? {} : { transform }),
    sourcePointers: [sourcePointer],
  }
}

function requestBodyPointer(tokens: readonly string[]): string {
  return tokens.length === 0 ? '#' : `#/${tokens.map(escapeJsonPointerToken).join('/')}`
}

function collectRequestBodyMappings(
  value: unknown,
  link: NormalizedLink,
  tokens: readonly string[],
  mappings: FlowDataMapping[],
  diagnostics: Diagnostic[],
): void {
  if (typeof value === 'string') {
    const source = appendSourcePointer(link.source, ['requestBody', ...tokens])
    const projected = projectTemplate(value, source)
    if (projected.diagnostic !== undefined) diagnostics.push(projected.diagnostic)
    if (projected.selector !== undefined) {
      mappings.push(
        mapping(
          projected.selector,
          { kind: 'request-body', pointer: requestBodyPointer(tokens) },
          source,
          projected.transform,
        ),
      )
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectRequestBodyMappings(entry, link, [...tokens, String(index)], mappings, diagnostics),
    )
    return
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      collectRequestBodyMappings(nested, link, [...tokens, key], mappings, diagnostics)
    }
  }
}

function addMappingBucket(
  buckets: Map<string, MappingBucket>,
  sourceNodeId: string,
  targetNodeId: string,
  link: NormalizedLink,
  mappings: readonly FlowDataMapping[],
): void {
  if (mappings.length === 0) return
  const key = `${sourceNodeId}\u0000${targetNodeId}`
  const bucket = buckets.get(key) ?? {
    sourceNodeId,
    targetNodeId,
    mappings: [],
    sourceStandardRefs: [],
  }
  bucket.mappings.push(...mappings)
  bucket.sourceStandardRefs.push({ standard: 'openapi-link', source: link.source })
  buckets.set(key, bucket)
}

function mergeOpenApiMappings(mappings: readonly FlowDataMapping[]): FlowDataMapping[] {
  const grouped = new Map<string, FlowDataMapping[]>()
  for (const value of mappings) {
    const group = grouped.get(value.id) ?? []
    group.push(value)
    grouped.set(value.id, group)
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => {
      const selected = group[0]!
      const pointers = new Map(
        group
          .flatMap(({ sourcePointers }) => sourcePointers)
          .map((source) => [`${source.uri}\u0000${source.pointer}`, source] as const),
      )
      return {
        ...selected,
        sourcePointers: [...pointers.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, source]) => source),
      }
    })
}

function uniqueStandardRefs(references: readonly SourceStandardRef[]): SourceStandardRef[] {
  const values = new Map(
    references.map(
      (reference) =>
        [
          `${reference.standard}\u0000${reference.source.uri}\u0000${reference.source.pointer}`,
          reference,
        ] as const,
    ),
  )
  return [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, reference]) => reference)
}

export { resolveLinkParameterTarget }

export function projectOpenApiLinks(source: FlowOpenApiSource): FlowProjectionFragment {
  const diagnostics: Diagnostic[] = []
  const nodes = source.document.operations.map((operation) => endpointNode(source, operation))
  const nodesByOperationKey = new Map(nodes.map((node) => [node.operationKey, node] as const))
  const operationsByKey = new Map(
    source.document.operations.map((operation) => [operation.id, operation] as const),
  )
  const buckets = new Map<string, MappingBucket>()

  for (const operation of source.document.operations) {
    const sourceNode = nodesByOperationKey.get(operation.id)!
    for (const response of operation.responses) {
      for (const link of response.links) {
        if (link.resolvedOperationKey === undefined) {
          diagnostics.push({
            code: DIAGNOSTIC_CODES.FLOW_ENDPOINT_TARGET_UNRESOLVED,
            severity: 'error',
            message: `OpenAPI Link "${link.name}" has no resolved target operation.`,
            source: link.source,
            details: { linkName: link.name, sourceOperationKey: operation.id },
          })
          continue
        }
        const targetOperation = operationsByKey.get(link.resolvedOperationKey)
        const targetNode = nodesByOperationKey.get(link.resolvedOperationKey)
        if (targetOperation === undefined || targetNode === undefined) {
          diagnostics.push({
            code: DIAGNOSTIC_CODES.FLOW_ENDPOINT_TARGET_UNRESOLVED,
            severity: 'error',
            message: `OpenAPI Link "${link.name}" target operation is outside its bound source.`,
            source: link.source,
            details: {
              linkName: link.name,
              sourceOperationKey: operation.id,
              targetOperationKey: link.resolvedOperationKey,
            },
          })
          continue
        }

        const mappings: FlowDataMapping[] = []
        for (const parameter of link.parameters) {
          const parameterSource = appendSourcePointer(link.source, ['parameters', parameter.target])
          const projected = projectExpression(parameter.expression, parameterSource)
          if (projected.diagnostic !== undefined) diagnostics.push(projected.diagnostic)
          if (projected.selector === undefined) continue

          const targets = matchingLinkParameterTargets(targetOperation, parameter.target)
          if (targets.length !== 1) {
            diagnostics.push(
              flowMappingDiagnostic(
                targets.length === 0
                  ? `OpenAPI Link target parameter "${parameter.target}" was not found.`
                  : `OpenAPI Link target parameter "${parameter.target}" is ambiguous.`,
                parameterSource,
                {
                  linkName: link.name,
                  targetOperationKey: targetOperation.id,
                  parameterTarget: parameter.target,
                  matchCount: targets.length,
                },
              ),
            )
            continue
          }
          mappings.push(mapping(projected.selector, targets[0]!, parameterSource))
        }

        if (link.requestBody !== undefined) {
          collectRequestBodyMappings(link.requestBody, link, [], mappings, diagnostics)
        }
        addMappingBucket(buckets, sourceNode.id, targetNode.id, link, mappings)
      }
    }
  }

  const edges: FlowEdge[] = [...buckets.values()]
    .map((bucket) => {
      const mappings = mergeOpenApiMappings(bucket.mappings)
      return {
        id: createEdgeId('data', bucket.sourceNodeId, bucket.targetNodeId, mappings),
        kind: 'data',
        sourceNodeId: bucket.sourceNodeId,
        targetNodeId: bucket.targetNodeId,
        provenance: DECLARED_FLOW_PROVENANCE,
        status: ACCEPTED_FLOW_STATUS,
        mappings,
        sourceStandardRefs: uniqueStandardRefs(bucket.sourceStandardRefs),
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    nodes: [...nodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges,
    diagnostics: sortDiagnostics(diagnostics),
  }
}
