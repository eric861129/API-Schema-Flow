import {
  HTTP_METHODS,
  createSourcePointer,
  type NormalizedApiDocument,
  type NormalizedComponentSchema,
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
    operations,
    componentSchemas,
  }

  return { document, diagnostics: sortDiagnostics(diagnostics) }
}
