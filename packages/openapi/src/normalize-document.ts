import {
  HTTP_METHODS,
  createSourcePointer,
  type NormalizedApiDocument,
  type NormalizedComponentSchema,
  type NormalizedLink,
  type NormalizedOperation,
} from '@api-schema-flow/domain'
import {
  DIAGNOSTIC_CODES,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'

import { isRecord, sortedRecordEntries, stringValue } from './openapi-like.js'
import {
  normalizeOperation,
  normalizeServers,
  operationMethodOrder,
} from './normalize-operation.js'
import { normalizeSchema, type SchemaReferenceResolver } from './normalize-schema.js'
import { detectOpenApiVersion } from './version.js'

export interface NormalizeOpenApiResult {
  readonly document?: NormalizedApiDocument
  readonly diagnostics: readonly Diagnostic[]
}

export interface NormalizeOpenApiOptions {
  readonly resolveReference?: SchemaReferenceResolver
}

function groupOperationsById(
  operations: readonly NormalizedOperation[],
): Map<string, NormalizedOperation[]> {
  const groups = new Map<string, NormalizedOperation[]>()
  for (const operation of operations) {
    if (operation.operationId === undefined) continue
    const current = groups.get(operation.operationId) ?? []
    current.push(operation)
    groups.set(operation.operationId, current)
  }
  return groups
}

function collectOperationConformanceDiagnostics(
  operations: readonly NormalizedOperation[],
  diagnostics: Diagnostic[],
): void {
  const operationIdGroups = groupOperationsById(operations)
  for (const [operationId, group] of [...operationIdGroups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (group.length < 2) continue
    diagnostics.push({
      code: DIAGNOSTIC_CODES.OPENAPI_DUPLICATE_OPERATION_ID,
      severity: 'error',
      message: `operationId "${operationId}" is declared by ${group.length} operations.`,
      source: group[0]!.source,
      details: {
        operationId,
        operationKeys: group.map(({ id }) => id),
      },
    })
  }

  for (const operation of operations) {
    const queryNames = new Set(
      operation.parameters.filter(({ location }) => location === 'query').map(({ name }) => name),
    )
    const conflicts = [
      ...new Set(
        operation.parameters
          .filter(({ location, name }) => location === 'querystring' && queryNames.has(name))
          .map(({ name }) => name),
      ),
    ].sort()

    for (const name of conflicts) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.OPENAPI_PARAMETER_LOCATION_CONFLICT,
        severity: 'warning',
        message: `Parameter "${name}" is declared in both query and querystring locations.`,
        source: operation.source,
        details: { operationKey: operation.id, parameterName: name },
      })
    }
  }
}

function operationRefPointer(operationRef: string, sourceUri: string): string | undefined {
  if (operationRef.startsWith('#')) return operationRef

  try {
    const target = new URL(operationRef, sourceUri)
    const targetPointer = target.hash
    target.hash = ''

    const source = new URL(sourceUri)
    source.hash = ''
    return target.href === source.href && targetPointer.length > 0 ? targetPointer : undefined
  } catch {
    return undefined
  }
}

function linkTargetLabel(link: NormalizedLink): string {
  return link.target.type === 'operationRef' ? link.target.operationRef : link.target.operationId
}

function resolveOperationLinks(
  operations: readonly NormalizedOperation[],
  sourceUri: string,
  diagnostics: Diagnostic[],
): NormalizedOperation[] {
  const operationIdGroups = groupOperationsById(operations)
  const operationsByPointer = new Map(
    operations.map((operation) => [operation.source.pointer, operation] as const),
  )

  const resolveLink = (link: NormalizedLink): NormalizedLink => {
    if (link.target.type === 'operationRef') {
      const pointer = operationRefPointer(link.target.operationRef, sourceUri)
      const target = pointer === undefined ? undefined : operationsByPointer.get(pointer)
      if (target !== undefined) {
        return { ...link, resolvedOperationKey: target.id }
      }

      diagnostics.push({
        code: DIAGNOSTIC_CODES.OPENAPI_LINK_TARGET_NOT_FOUND,
        severity: 'error',
        message: `Link "${link.name}" target "${link.target.operationRef}" was not found.`,
        source: link.source,
        details: { target: link.target.operationRef },
      })
      return link
    }

    const candidates = operationIdGroups.get(link.target.operationId) ?? []
    if (candidates.length === 1) {
      return { ...link, resolvedOperationKey: candidates[0]!.id }
    }

    if (candidates.length > 1) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.OPENAPI_LINK_TARGET_AMBIGUOUS,
        severity: 'error',
        message: `Link "${link.name}" operationId target "${link.target.operationId}" is ambiguous.`,
        source: link.source,
        details: {
          target: link.target.operationId,
          operationKeys: candidates.map(({ id }) => id),
        },
      })
      return link
    }

    diagnostics.push({
      code: DIAGNOSTIC_CODES.OPENAPI_LINK_TARGET_NOT_FOUND,
      severity: 'error',
      message: `Link "${link.name}" target "${linkTargetLabel(link)}" was not found.`,
      source: link.source,
      details: { target: linkTargetLabel(link) },
    })
    return link
  }

  return operations.map((operation) => ({
    ...operation,
    responses: operation.responses.map((response) => ({
      ...response,
      links: response.links.map(resolveLink),
    })),
  }))
}

export function normalizeOpenApiDocument(
  input: unknown,
  source: SourceDocument,
  options: NormalizeOpenApiOptions = {},
): NormalizeOpenApiResult {
  const versionResult = detectOpenApiVersion(input, source.uri)
  const diagnostics: Diagnostic[] = [...versionResult.diagnostics]
  if (!versionResult.version || hasDiagnosticErrors(diagnostics) || !isRecord(input)) {
    return { diagnostics: sortDiagnostics(diagnostics) }
  }

  if (!isRecord(input.paths)) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.OPENAPI_PATHS_INVALID,
      severity: 'error',
      message: 'OpenAPI paths must be an object.',
      source: createSourcePointer(source.uri, ['paths']),
    })
    return { diagnostics: sortDiagnostics(diagnostics) }
  }

  const operations: NormalizedOperation[] = []
  for (const [path, pathValue] of sortedRecordEntries(input.paths)) {
    if (!isRecord(pathValue)) continue
    for (const method of HTTP_METHODS) {
      const operationValue = pathValue[method]
      if (operationValue === undefined) continue
      if (!isRecord(operationValue)) {
        diagnostics.push({
          code: DIAGNOSTIC_CODES.OPENAPI_OPERATION_INVALID,
          severity: 'error',
          message: `${method.toUpperCase()} ${path} must be an operation object.`,
          source: createSourcePointer(source.uri, ['paths', path, method]),
        })
        continue
      }
      operations.push(
        normalizeOperation({
          sourceUri: source.uri,
          path,
          method,
          pathItem: pathValue,
          operation: operationValue,
          rootSecurity: input.security,
          rootServers: input.servers,
          ...(options.resolveReference === undefined
            ? {}
            : { referenceResolver: options.resolveReference }),
        }),
      )
    }
  }

  if (hasDiagnosticErrors(diagnostics)) {
    return { diagnostics: sortDiagnostics(diagnostics) }
  }

  operations.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      operationMethodOrder(left.method) - operationMethodOrder(right.method),
  )
  collectOperationConformanceDiagnostics(operations, diagnostics)
  const resolvedOperations = resolveOperationLinks(operations, source.uri, diagnostics)

  const components = isRecord(input.components) ? input.components : {}
  const componentSchemas: NormalizedComponentSchema[] = sortedRecordEntries(
    components.schemas,
  ).flatMap(([name, schemaValue]) => {
    const schemaSource = createSourcePointer(source.uri, ['components', 'schemas', name])
    const schema = normalizeSchema(
      schemaValue,
      schemaSource,
      new WeakSet(),
      undefined,
      options.resolveReference,
    )
    return schema ? [{ name, schema, source: schemaSource }] : []
  })

  const infoValue = isRecord(input.info) ? input.info : {}
  const description = stringValue(infoValue.description)
  const document: NormalizedApiDocument = {
    schemaVersion: '1.0',
    sourceUri: source.uri,
    openapiVersion: versionResult.version,
    compatibilityMode: versionResult.compatibilityMode,
    info: {
      title: stringValue(infoValue.title) ?? 'Untitled API',
      version: stringValue(infoValue.version) ?? '0.0.0',
      ...(description === undefined ? {} : { description }),
    },
    tags: sortedRecordEntries(
      Array.isArray(input.tags)
        ? Object.fromEntries(
            input.tags.flatMap((entry) => {
              const name = isRecord(entry) ? stringValue(entry.name) : undefined
              return name ? [[name, true]] : []
            }),
          )
        : {},
    ).map(([name]) => name),
    servers: normalizeServers(input.servers, createSourcePointer(source.uri, ['servers'])),
    operations: resolvedOperations,
    componentSchemas,
  }

  return { document, diagnostics: sortDiagnostics(diagnostics) }
}
