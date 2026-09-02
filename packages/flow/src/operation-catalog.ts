import type { ArazzoOperationCatalog } from '@api-schema-flow/arazzo'

import type { FlowOpenApiSource } from './contracts.js'

export function createArazzoOperationCatalogs(
  sources: readonly FlowOpenApiSource[],
): readonly ArazzoOperationCatalog[] {
  return sources
    .flatMap((source): ArazzoOperationCatalog[] => {
      if (source.sourceName === undefined) return []
      return [
        {
          sourceName: source.sourceName,
          sourceUri: source.document.sourceUri,
          sourceType: 'openapi',
          operations: [...source.document.operations]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((operation) => ({
              key: operation.id,
              ...(operation.operationId === undefined
                ? {}
                : { operationId: operation.operationId }),
              operationPath: operation.source.pointer,
            })),
        },
      ]
    })
    .sort(
      (left, right) =>
        left.sourceName.localeCompare(right.sourceName) ||
        left.sourceUri.localeCompare(right.sourceUri),
    )
}
