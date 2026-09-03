import { readFile, writeFile } from 'node:fs/promises'

const path = 'tooling/scripts/scaffold-m3a-implementation.mjs'
const source = await readFile(path, 'utf8')
let fixed = source

function replaceRequired(search, replacement, description) {
  if (!fixed.includes(search)) {
    throw new Error(`Expected ${description} marker was not found in the scaffold.`)
  }
  fixed = fixed.replace(search, replacement)
}

replaceRequired(
  'group: ci-${{ github.workflow }}-${{ github.ref }}',
  'group: ci-\\${{ github.workflow }}-\\${{ github.ref }}',
  'GitHub Actions interpolation',
)

replaceRequired(
  `function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}`,
  `interface ElkPointResult {
  readonly x?: number
  readonly y?: number
}

interface ElkEdgeSectionResult {
  readonly startPoint?: ElkPointResult
  readonly bendPoints?: readonly ElkPointResult[]
  readonly endPoint?: ElkPointResult
}

interface ElkNodeResult {
  readonly id: string
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
}

interface ElkEdgeResult {
  readonly id: string
  readonly sources?: readonly string[]
  readonly targets?: readonly string[]
  readonly sections?: readonly ElkEdgeSectionResult[]
}

interface ElkLayoutResult {
  readonly width?: number
  readonly height?: number
  readonly children?: readonly ElkNodeResult[]
  readonly edges?: readonly ElkEdgeResult[]
}

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}`,
  'ELK result boundary',
)

replaceRequired(
  `        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.sourceNodeId],
          targets: [edge.targetNodeId],
        })),
      })`,
  `        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.sourceNodeId],
          targets: [edge.targetNodeId],
        })),
      }) as unknown as ElkLayoutResult`,
  'ELK layout result cast',
)

if (fixed === source) {
  throw new Error('The M3-A scaffold did not change.')
}

await writeFile(path, fixed, 'utf8')
console.log('Applied GitHub Actions escaping and ELK result-boundary fixes to M3-A scaffold.')
