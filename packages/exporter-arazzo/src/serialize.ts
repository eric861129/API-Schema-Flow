import { stringify as stringifyYaml } from 'yaml'

import type { CanonicalArazzoDocument } from './document-builder.js'

export function serializeArazzoDocument(
  document: CanonicalArazzoDocument,
  format: 'yaml' | 'json',
): string {
  if (format === 'json') return `${JSON.stringify(document, null, 2)}\n`
  const contents = stringifyYaml(document, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  })
  return contents.endsWith('\n') ? contents : `${contents}\n`
}
