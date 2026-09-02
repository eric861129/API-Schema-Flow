import type { RuntimeExpression } from '@api-schema-flow/arazzo'
import type { FlowValueSelector } from '@api-schema-flow/domain'

export function runtimeExpressionToSelector(
  expression: RuntimeExpression,
): FlowValueSelector | undefined {
  if (expression.kind === 'context') {
    return expression.context === 'statusCode' ? { kind: 'status-code' } : undefined
  }

  if (expression.kind === 'named') {
    return expression.scope === 'inputs'
      ? { kind: 'workflow-input', name: expression.name }
      : undefined
  }

  if (expression.kind !== 'http') return undefined

  if (expression.message === 'request') {
    switch (expression.location) {
      case 'header':
        return expression.name === undefined
          ? undefined
          : { kind: 'request-header', name: expression.name }
      case 'query':
        return expression.name === undefined
          ? undefined
          : { kind: 'request-query', name: expression.name }
      case 'path':
        return expression.name === undefined
          ? undefined
          : { kind: 'request-path', name: expression.name }
      case 'body':
        return expression.pointer === undefined
          ? undefined
          : { kind: 'request-body', pointer: expression.pointer }
    }
  }

  switch (expression.location) {
    case 'header':
      return expression.name === undefined
        ? undefined
        : { kind: 'response-header', name: expression.name }
    case 'body':
      return expression.pointer === undefined
        ? undefined
        : { kind: 'response-body', pointer: expression.pointer }
    case 'query':
    case 'path':
      return undefined
  }
}
