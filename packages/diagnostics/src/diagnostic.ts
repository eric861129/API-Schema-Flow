import type { SourcePointer } from '@api-schema-flow/domain'

export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  readonly code: string
  readonly severity: DiagnosticSeverity
  readonly message: string
  readonly source?: SourcePointer
  readonly details?: Readonly<Record<string, unknown>>
}

const SEVERITY_ORDER: Readonly<Record<DiagnosticSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
}

function compareSource(left?: SourcePointer, right?: SourcePointer): number {
  const leftValue = left ? `${left.uri}${left.pointer}` : ''
  const rightValue = right ? `${right.uri}${right.pointer}` : ''
  return leftValue.localeCompare(rightValue)
}

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((left, right) => {
    return (
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      left.code.localeCompare(right.code) ||
      compareSource(left.source, right.source) ||
      left.message.localeCompare(right.message)
    )
  })
}

export function hasDiagnosticErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some(({ severity }) => severity === 'error')
}
