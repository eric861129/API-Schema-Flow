import { sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import { analyzeWorkflowDependencies } from './dependency-analysis.js'
import type {
  NormalizedArazzoDocument,
  NormalizedArazzoParameter,
  NormalizedArazzoWorkflow,
} from './model.js'

function duplicateDiagnostics<T>(
  values: readonly T[],
  key: (value: T) => string,
  diagnostic: (value: T, duplicateKey: string) => Diagnostic,
): Diagnostic[] {
  const seen = new Set<string>()
  const results: Diagnostic[] = []
  for (const value of values) {
    const duplicateKey = key(value)
    if (seen.has(duplicateKey)) results.push(diagnostic(value, duplicateKey))
    else seen.add(duplicateKey)
  }
  return results
}

function parameterKey(parameter: NormalizedArazzoParameter): string {
  const location = parameter.location.toLowerCase()
  const name = location === 'header' ? parameter.name.toLowerCase() : parameter.name
  return `${location}:${name}`
}

function validateParameters(
  parameters: readonly NormalizedArazzoParameter[],
  owner: string,
): Diagnostic[] {
  return duplicateDiagnostics(parameters, parameterKey, (parameter) => ({
    code: 'ASF-ARZ-1017',
    severity: 'error',
    message: `Duplicate parameter "${parameter.name}" in ${owner}.`,
    source: parameter.source,
    details: { owner, name: parameter.name, location: parameter.location },
  }))
}

function validateWorkflow(workflow: NormalizedArazzoWorkflow): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  diagnostics.push(...validateParameters(workflow.parameters, `workflow "${workflow.workflowId}"`))
  diagnostics.push(
    ...duplicateDiagnostics(
      workflow.steps,
      ({ stepId }) => stepId,
      (step, stepId) => ({
        code: 'ASF-ARZ-1006',
        severity: 'error',
        message: `Duplicate stepId "${stepId}" in workflow "${workflow.workflowId}".`,
        source: step.source,
        details: { workflowId: workflow.workflowId, stepId },
      }),
    ),
  )

  for (const step of workflow.steps) {
    if (step.targets.length !== 1) {
      diagnostics.push({
        code: 'ASF-ARZ-1007',
        severity: 'error',
        message: `Step "${step.stepId}" must declare exactly one operation or workflow target.`,
        source: step.source,
        details: {
          workflowId: workflow.workflowId,
          stepId: step.stepId,
          targetCount: step.targets.length,
        },
      })
    }
    diagnostics.push(
      ...validateParameters(step.parameters, `step "${workflow.workflowId}.${step.stepId}"`),
    )
  }

  diagnostics.push(...analyzeWorkflowDependencies(workflow).diagnostics)
  return diagnostics
}

export function validateArazzoDocument(document: NormalizedArazzoDocument): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  diagnostics.push(
    ...duplicateDiagnostics(
      document.sourceDescriptions,
      ({ name }) => name,
      (sourceDescription, name) => ({
        code: 'ASF-ARZ-1004',
        severity: 'error',
        message: `Duplicate Source Description name "${name}".`,
        source: sourceDescription.source,
        details: { name },
      }),
    ),
  )
  diagnostics.push(
    ...duplicateDiagnostics(
      document.workflows,
      ({ workflowId }) => workflowId,
      (workflow, workflowId) => ({
        code: 'ASF-ARZ-1005',
        severity: 'error',
        message: `Duplicate workflowId "${workflowId}".`,
        source: workflow.source,
        details: { workflowId },
      }),
    ),
  )
  for (const workflow of document.workflows) diagnostics.push(...validateWorkflow(workflow))
  return sortDiagnostics(diagnostics)
}
