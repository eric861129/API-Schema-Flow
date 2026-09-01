import { formatSourcePointer } from '@api-schema-flow/domain'

import type { Diagnostic } from './diagnostic.js'

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const source = diagnostic.source ? ` ${formatSourcePointer(diagnostic.source)}` : ''
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${source}: ${diagnostic.message}`
}
