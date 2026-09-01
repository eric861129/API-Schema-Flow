import type { SourcePointer } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

export type RuntimeExpressionKind =
  | 'context'
  | 'http'
  | 'message'
  | 'named'
  | 'step-output'
  | 'workflow-output'
  | 'source-operation'
  | 'component'

interface RuntimeExpressionBase {
  readonly kind: RuntimeExpressionKind
  readonly raw: string
  readonly source?: SourcePointer
}

export interface RuntimeContextExpression extends RuntimeExpressionBase {
  readonly kind: 'context'
  readonly context: 'url' | 'method' | 'statusCode' | 'self'
}

export interface RuntimeHttpExpression extends RuntimeExpressionBase {
  readonly kind: 'http'
  readonly message: 'request' | 'response'
  readonly location: 'header' | 'query' | 'path' | 'body'
  readonly name?: string
  readonly pointer?: string
}

export interface RuntimeMessageExpression extends RuntimeExpressionBase {
  readonly kind: 'message'
  readonly location: 'header' | 'payload'
  readonly name?: string
  readonly pointer?: string
}

export interface RuntimeNamedExpression extends RuntimeExpressionBase {
  readonly kind: 'named'
  readonly scope: 'inputs' | 'outputs'
  readonly name: string
}

export interface RuntimeStepOutputExpression extends RuntimeExpressionBase {
  readonly kind: 'step-output'
  readonly stepId: string
  readonly outputName: string
}

export interface RuntimeWorkflowOutputExpression extends RuntimeExpressionBase {
  readonly kind: 'workflow-output'
  readonly workflowId: string
  readonly outputName: string
}

export interface RuntimeSourceOperationExpression extends RuntimeExpressionBase {
  readonly kind: 'source-operation'
  readonly sourceName: string
  readonly operationId: string
}

export interface RuntimeComponentExpression extends RuntimeExpressionBase {
  readonly kind: 'component'
  readonly componentType: string
  readonly name: string
}

export type RuntimeExpression =
  | RuntimeContextExpression
  | RuntimeHttpExpression
  | RuntimeMessageExpression
  | RuntimeNamedExpression
  | RuntimeStepOutputExpression
  | RuntimeWorkflowOutputExpression
  | RuntimeSourceOperationExpression
  | RuntimeComponentExpression

export interface ParseRuntimeExpressionResult {
  readonly expression?: RuntimeExpression
  readonly diagnostics: readonly Diagnostic[]
}

const IDENTIFIER = '[A-Za-z0-9_-]+'
const HTTP_NAME = "[A-Za-z0-9!#$%&'*+\\-.^_`|~]+"
const JSON_POINTER_FRAGMENT = /^#(?:\/(?:[^~]|~[01])*)*$/u

function withSource<T extends { readonly kind: RuntimeExpressionKind; readonly raw: string }>(
  value: T,
  source: SourcePointer | undefined,
): T & { readonly source?: SourcePointer } {
  return {
    ...value,
    ...(source === undefined ? {} : { source }),
  }
}

function invalidExpression(
  raw: string,
  source?: SourcePointer,
): ParseRuntimeExpressionResult {
  return {
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.ARAZZO_RUNTIME_EXPRESSION_INVALID,
        severity: 'error',
        message: `Invalid Arazzo Runtime Expression: "${raw}".`,
        ...(source === undefined ? {} : { source }),
        details: { raw },
      },
    ],
  }
}

function validPointer(pointer: string): boolean {
  return JSON_POINTER_FRAGMENT.test(pointer)
}

export function parseRuntimeExpression(
  raw: string,
  source?: SourcePointer,
): ParseRuntimeExpressionResult {
  const contexts: Readonly<Record<string, RuntimeContextExpression['context']>> = {
    $url: 'url',
    $method: 'method',
    $statusCode: 'statusCode',
    $self: 'self',
  }
  const context = contexts[raw]
  if (context !== undefined) {
    return {
      expression: withSource({ kind: 'context', raw, context }, source),
      diagnostics: [],
    }
  }

  const httpNamed = new RegExp(`^\\$(request|response)\\.(header|query|path)\\.(${HTTP_NAME})$`).exec(
    raw,
  )
  if (httpNamed) {
    return {
      expression: withSource(
        {
          kind: 'http',
          raw,
          message: httpNamed[1] as 'request' | 'response',
          location: httpNamed[2] as 'header' | 'query' | 'path',
          name: httpNamed[3]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const httpBody = /^\$(request|response)\.body(.+)$/u.exec(raw)
  if (httpBody && validPointer(httpBody[2]!)) {
    return {
      expression: withSource(
        {
          kind: 'http',
          raw,
          message: httpBody[1] as 'request' | 'response',
          location: 'body',
          pointer: httpBody[2]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const messageHeader = new RegExp(`^\\$message\\.header\\.(${HTTP_NAME})$`).exec(raw)
  if (messageHeader) {
    return {
      expression: withSource(
        {
          kind: 'message',
          raw,
          location: 'header',
          name: messageHeader[1]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const messagePayload = /^\$message\.payload(.+)$/u.exec(raw)
  if (messagePayload && validPointer(messagePayload[1]!)) {
    return {
      expression: withSource(
        {
          kind: 'message',
          raw,
          location: 'payload',
          pointer: messagePayload[1]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const named = new RegExp(`^\\$(inputs|outputs)\\.(${IDENTIFIER})$`).exec(raw)
  if (named) {
    return {
      expression: withSource(
        {
          kind: 'named',
          raw,
          scope: named[1] as 'inputs' | 'outputs',
          name: named[2]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const stepOutput = new RegExp(
    `^\\$steps\\.(${IDENTIFIER})\\.outputs\\.(${IDENTIFIER})$`,
  ).exec(raw)
  if (stepOutput) {
    return {
      expression: withSource(
        {
          kind: 'step-output',
          raw,
          stepId: stepOutput[1]!,
          outputName: stepOutput[2]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const workflowOutput = new RegExp(
    `^\\$workflows\\.(${IDENTIFIER})\\.outputs\\.(${IDENTIFIER})$`,
  ).exec(raw)
  if (workflowOutput) {
    return {
      expression: withSource(
        {
          kind: 'workflow-output',
          raw,
          workflowId: workflowOutput[1]!,
          outputName: workflowOutput[2]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const sourceOperation = new RegExp(
    `^\\$sourceDescriptions\\.(${IDENTIFIER})\\.(${IDENTIFIER})$`,
  ).exec(raw)
  if (sourceOperation) {
    return {
      expression: withSource(
        {
          kind: 'source-operation',
          raw,
          sourceName: sourceOperation[1]!,
          operationId: sourceOperation[2]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  const component = new RegExp(`^\\$components\\.(${IDENTIFIER})\\.(${IDENTIFIER})$`).exec(raw)
  if (component) {
    return {
      expression: withSource(
        {
          kind: 'component',
          raw,
          componentType: component[1]!,
          name: component[2]!,
        },
        source,
      ),
      diagnostics: [],
    }
  }

  return invalidExpression(raw, source)
}
