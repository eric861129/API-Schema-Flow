import { createHash } from 'node:crypto'

import { processArazzoSource } from '@api-schema-flow/arazzo'
import { hasDiagnosticErrors, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import { createSourceDocument } from '@api-schema-flow/source-loader'

import { bindWorkflowPlanOperations } from './operation-binding.js'
import { projectAcceptedMappings } from './mapping-projector.js'
import type { ArazzoExportArtifact, ExportArazzoInput } from './contracts.js'
import { buildCanonicalArazzoDocument } from './document-builder.js'
import { serializeArazzoDocument } from './serialize.js'
import { validateArazzoWorkflowPlan } from './validate-workflow-plan.js'

function slug(value: string): string {
  const result = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 96)
  return result.length === 0 ? 'workflow' : result
}

function mediaType(format: 'yaml' | 'json'): ArazzoExportArtifact['mediaType'] {
  return format === 'yaml' ? 'application/yaml' : 'application/json'
}

function fileName(input: ExportArazzoInput): string {
  return `${slug(input.workflowPlan.workflowId)}.arazzo.${input.format === 'yaml' ? 'yaml' : 'json'}`
}

function emptyArtifact(
  input: ExportArazzoInput,
  diagnostics: readonly Diagnostic[],
): ArazzoExportArtifact {
  return {
    fileName: fileName(input),
    mediaType: mediaType(input.format),
    contents: '',
    contentHash: '',
    diagnostics: sortDiagnostics(diagnostics),
  }
}

function credentialDiagnostics(input: ExportArazzoInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const [index, source] of input.workflowPlan.sourceDescriptions.entries()) {
    try {
      const parsed = new URL(source.url, 'https://schema-flow.invalid/')
      if (parsed.username.length > 0 || parsed.password.length > 0) {
        diagnostics.push({
          code: 'ASF-EXP-1007',
          severity: 'error',
          message: `Source Description "${source.name}" URL must not contain credentials.`,
          source: { uri: 'memory://workflow-plan', pointer: `#/sourceDescriptions/${index}/url` },
          details: { name: source.name },
        })
      }
    } catch {
      // URL shape is reported by the generated Arazzo validation path.
    }
  }
  return diagnostics
}

function likelySecret(contents: string): boolean {
  const patterns = [
    /\b(?:sk|ghp|gho|ghu|ghs|github_pat|xoxb|xoxa|xoxp|xoxr)[-_][A-Za-z0-9_-]{12,}\b/gu,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu,
    /\bBearer\s+(?!\{?\$)[A-Za-z0-9._~+/-]{12,}\b/giu,
  ]
  return patterns.some((pattern) => pattern.test(contents))
}

export async function exportArazzo(input: ExportArazzoInput): Promise<ArazzoExportArtifact> {
  const safetyDiagnostics = credentialDiagnostics(input)
  if (safetyDiagnostics.length > 0) return emptyArtifact(input, safetyDiagnostics)

  const validated = validateArazzoWorkflowPlan({
    workflowPlan: input.workflowPlan,
    acceptedOperationGraph: input.acceptedOperationGraph,
  })
  if (validated.workflowPlan === undefined || hasDiagnosticErrors(validated.diagnostics)) {
    return emptyArtifact(input, validated.diagnostics)
  }

  const bound = bindWorkflowPlanOperations({
    workflowPlan: validated.workflowPlan,
    acceptedOperationGraph: input.acceptedOperationGraph,
    openApiSources: input.openApiSources,
  })
  if (hasDiagnosticErrors(bound.diagnostics)) return emptyArtifact(input, bound.diagnostics)

  const projected = projectAcceptedMappings({
    workflowPlan: validated.workflowPlan,
    acceptedOperationGraph: input.acceptedOperationGraph,
    boundSteps: bound.steps,
  })
  if (hasDiagnosticErrors(projected.diagnostics)) return emptyArtifact(input, projected.diagnostics)

  const document = buildCanonicalArazzoDocument({
    title: input.title,
    version: input.version,
    workflowId: validated.workflowPlan.workflowId,
    ...(validated.workflowPlan.summary === undefined
      ? {}
      : { summary: validated.workflowPlan.summary }),
    ...(validated.workflowPlan.description === undefined
      ? {}
      : { description: validated.workflowPlan.description }),
    sourceDescriptionCount: validated.workflowPlan.sourceDescriptions.length,
    boundSteps: bound.steps,
    projectedSteps: projected.steps,
  })
  const contents = serializeArazzoDocument(document, input.format)
  if (likelySecret(contents)) {
    return emptyArtifact(input, [
      {
        code: 'ASF-EXP-1007',
        severity: 'error',
        message: 'Generated Arazzo contains a credential-shaped value and was blocked.',
        source: { uri: 'memory://generated-arazzo', pointer: '#' },
      },
    ])
  }

  const sourceResult = createSourceDocument({
    uri: `memory://generated/${fileName(input)}`,
    contents,
    mediaType: mediaType(input.format),
  })
  if (sourceResult.source === undefined) return emptyArtifact(input, sourceResult.diagnostics)

  const processed = processArazzoSource(sourceResult.source)
  const validationDiagnostics = processed.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    code: hasDiagnosticErrors([diagnostic]) ? 'ASF-EXP-1008' : diagnostic.code,
  }))
  if (processed.document === undefined || hasDiagnosticErrors(processed.diagnostics)) {
    return emptyArtifact(input, validationDiagnostics)
  }

  return {
    fileName: fileName(input),
    mediaType: mediaType(input.format),
    contents,
    contentHash: createHash('sha256').update(contents, 'utf8').digest('hex'),
    document: processed.document,
    diagnostics: sortDiagnostics(validationDiagnostics),
  }
}
