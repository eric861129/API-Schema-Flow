import type { ReviewCandidateRow } from './review-selectors'

export type ReviewEvidenceKind = 'positive' | 'negative' | 'neutral'

export interface ReviewEvidenceDetail {
  readonly ruleId: string
  readonly kind: ReviewEvidenceKind
  readonly weight: number
  readonly summary: string
  readonly sourcePointers: readonly string[]
}

export interface ReviewBlockerDetail {
  readonly code: string
  readonly summary: string
  readonly sourcePointers: readonly string[]
}

export interface ReviewSchemaDescriptor {
  readonly type?: string
  readonly format?: string
  readonly required?: boolean
  readonly arrayDepth?: number
}

export interface ReviewCandidateDetail extends ReviewCandidateRow {
  readonly ruleSetVersion: string
  readonly fingerprint: string
  readonly sourceSchema: ReviewSchemaDescriptor
  readonly targetSchema: ReviewSchemaDescriptor
  readonly alias?: string
  readonly transform?: string
  readonly evidence: readonly ReviewEvidenceDetail[]
  readonly blockers: readonly ReviewBlockerDetail[]
}

export interface ReviewCompatibilityItem {
  readonly state: 'compatible' | 'warning' | 'blocked' | 'unknown'
  readonly label: string
}

export function describeReviewCompatibility(
  candidate: ReviewCandidateDetail,
): readonly ReviewCompatibilityItem[] {
  const items: ReviewCompatibilityItem[] = []
  const sourceType = candidate.sourceSchema.type
  const targetType = candidate.targetSchema.type
  const sourceFormat = candidate.sourceSchema.format
  const targetFormat = candidate.targetSchema.format

  if (sourceType && targetType) {
    items.push(
      sourceType === targetType
        ? { state: 'compatible', label: `Type compatible · ${sourceType}` }
        : { state: 'blocked', label: `Type mismatch · ${sourceType} → ${targetType}` },
    )
  } else {
    items.push({ state: 'unknown', label: 'Schema type is incomplete' })
  }

  if (sourceFormat && targetFormat) {
    items.push(
      sourceFormat === targetFormat
        ? { state: 'compatible', label: `Format compatible · ${sourceFormat}` }
        : { state: 'warning', label: `Format differs · ${sourceFormat} → ${targetFormat}` },
    )
  }

  if ((candidate.sourceSchema.arrayDepth ?? 0) > 0) {
    items.push({
      state: 'warning',
      label: `Source is nested in an array at depth ${candidate.sourceSchema.arrayDepth}`,
    })
  }

  if (candidate.targetSchema.required) {
    items.push({ state: 'compatible', label: 'Target value is required' })
  }

  for (const blocker of candidate.blockers) {
    items.push({ state: 'blocked', label: blocker.summary })
  }

  return items
}

export function groupReviewEvidence(candidate: ReviewCandidateDetail): Readonly<
  Record<ReviewEvidenceKind, readonly ReviewEvidenceDetail[]>
> {
  const sorted = candidate.evidence.toSorted(
    (left, right) =>
      Math.abs(right.weight) - Math.abs(left.weight) || left.ruleId.localeCompare(right.ruleId),
  )

  return {
    positive: sorted.filter(({ kind }) => kind === 'positive'),
    negative: sorted.filter(({ kind }) => kind === 'negative'),
    neutral: sorted.filter(({ kind }) => kind === 'neutral'),
  }
}
