import type { FlowDataMapping, FlowEdge, FlowValueTransform } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import type {
  ProjectAcceptedMappingsInput,
  ProjectAcceptedMappingsResult,
  ProjectedArazzoParameter,
  ProjectedArazzoStep,
} from './contracts.js'
import { disambiguateOutputName, projectSourceOutput } from './output-projector.js'
import { assignRequestBodyValue, parameterTarget, requestBodySegments } from './target-projector.js'

interface MutableStep {
  readonly stepId: string
  readonly description?: string
  readonly outputs: Record<string, string>
  readonly parameters: Map<string, ProjectedArazzoParameter>
  readonly requestBody: Record<string, unknown>
  readonly dependsOn: Set<string>
}

function sourceValue(
  stepId: string,
  outputName: string,
  transform: FlowValueTransform | undefined,
): string | undefined {
  const expression = `$steps.${stepId}.outputs.${outputName}`
  if (transform === undefined) return expression
  if (transform.kind !== 'template') return undefined
  const matches = transform.raw.match(/\{\$[^}]+\}/gu) ?? []
  if (matches.length !== 1) return undefined
  return transform.raw.replace(matches[0]!, `{${expression}}`)
}

function parameterKey(parameter: ProjectedArazzoParameter): string {
  const name = parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name
  return `${parameter.in}\u0000${name}`
}

function outputForMapping(
  mapping: FlowDataMapping,
  step: MutableStep,
): { readonly name: string; readonly value: string } | undefined {
  const projected = projectSourceOutput(mapping.source)
  if (projected === undefined) return undefined
  const name = disambiguateOutputName(
    projected.name,
    mapping.source,
    step.outputs,
    projected.expression,
  )
  return { name, value: projected.expression }
}

function supportedEdge(edge: FlowEdge): boolean {
  return edge.kind === 'data' && edge.status === 'accepted'
}

export function projectAcceptedMappings(
  input: ProjectAcceptedMappingsInput,
): ProjectAcceptedMappingsResult {
  const diagnostics: Diagnostic[] = []
  const indexes = new Map(input.workflowPlan.steps.map((step, index) => [step.stepId, index]))
  const boundByNode = new Map<string, typeof input.boundSteps>()
  for (const step of input.boundSteps) {
    const current = boundByNode.get(step.node.id) ?? []
    boundByNode.set(step.node.id, [...current, step])
  }
  const mutable = new Map<string, MutableStep>()
  for (const step of input.workflowPlan.steps) {
    mutable.set(step.stepId, {
      stepId: step.stepId,
      ...(step.description === undefined ? {} : { description: step.description }),
      outputs: {},
      parameters: new Map(),
      requestBody: {},
      dependsOn: new Set(),
    })
  }

  const invalid = (code: string, message: string, edge: FlowEdge, mapping: FlowDataMapping) => {
    const source = mapping.sourcePointers[0] ?? edge.sourceStandardRefs[0]?.source
    diagnostics.push({
      code,
      severity: 'error',
      message,
      ...(source === undefined ? {} : { source }),
      details: { edgeId: edge.id, mappingId: mapping.id },
    })
  }

  const edges = input.acceptedOperationGraph.edges
    .filter(supportedEdge)
    .sort((left, right) => left.id.localeCompare(right.id))
  for (const edge of edges) {
    const sourceSteps = boundByNode.get(edge.sourceNodeId) ?? []
    const targetSteps = boundByNode.get(edge.targetNodeId) ?? []
    if (sourceSteps.length === 0 || targetSteps.length === 0) continue
    if (sourceSteps.length !== 1 || targetSteps.length !== 1) {
      for (const mapping of edge.mappings) {
        invalid(
          DIAGNOSTIC_CODES.EXPORT_OPERATION_BINDING_INVALID,
          `Accepted mapping "${mapping.id}" is ambiguous because an operation appears more than once in the workflow plan.`,
          edge,
          mapping,
        )
      }
      continue
    }
    const sourceStep = sourceSteps[0]!
    const targetStep = targetSteps[0]!
    const sourceIndex = indexes.get(sourceStep.stepId)!
    const targetIndex = indexes.get(targetStep.stepId)!

    for (const mapping of [...edge.mappings].sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      if (sourceIndex >= targetIndex) {
        invalid(
          DIAGNOSTIC_CODES.EXPORT_MAPPING_FORWARD_REFERENCE,
          `Mapping "${mapping.id}" references a source step that is not earlier than its target step.`,
          edge,
          mapping,
        )
        continue
      }
      const sourceMutable = mutable.get(sourceStep.stepId)!
      const targetMutable = mutable.get(targetStep.stepId)!
      const output = outputForMapping(mapping, sourceMutable)
      if (output === undefined) {
        invalid(
          DIAGNOSTIC_CODES.EXPORT_MAPPING_UNSUPPORTED,
          `Mapping "${mapping.id}" uses an unsupported source selector.`,
          edge,
          mapping,
        )
        continue
      }
      const value = sourceValue(sourceStep.stepId, output.name, mapping.transform)
      if (value === undefined) {
        invalid(
          DIAGNOSTIC_CODES.EXPORT_MAPPING_UNSUPPORTED,
          `Mapping "${mapping.id}" uses an unsupported transform.`,
          edge,
          mapping,
        )
        continue
      }

      const parameter = parameterTarget(mapping.target, value)
      if (parameter !== undefined) {
        const key = parameterKey(parameter)
        const current = targetMutable.parameters.get(key)
        if (current !== undefined && current.value !== parameter.value) {
          invalid(
            DIAGNOSTIC_CODES.EXPORT_TARGET_CONFLICT,
            `Mapping "${mapping.id}" conflicts with another assignment to ${parameter.in} parameter "${parameter.name}".`,
            edge,
            mapping,
          )
          continue
        }
        targetMutable.parameters.set(key, parameter)
      } else if (mapping.target.kind === 'request-body') {
        const segments = requestBodySegments(mapping.target)
        if (segments === undefined || segments.length === 0) {
          invalid(
            DIAGNOSTIC_CODES.EXPORT_MAPPING_UNSUPPORTED,
            `Mapping "${mapping.id}" uses an unsupported request-body target.`,
            edge,
            mapping,
          )
          continue
        }
        const assigned = assignRequestBodyValue(targetMutable.requestBody, segments, value)
        if (assigned === 'conflict') {
          invalid(
            DIAGNOSTIC_CODES.EXPORT_TARGET_CONFLICT,
            `Mapping "${mapping.id}" conflicts with another request-body assignment.`,
            edge,
            mapping,
          )
          continue
        }
      } else {
        invalid(
          DIAGNOSTIC_CODES.EXPORT_MAPPING_UNSUPPORTED,
          `Mapping "${mapping.id}" uses an unsupported target.`,
          edge,
          mapping,
        )
        continue
      }

      sourceMutable.outputs[output.name] = output.value
      targetMutable.dependsOn.add(sourceStep.stepId)
    }
  }

  const steps: ProjectedArazzoStep[] = input.workflowPlan.steps.map((planStep) => {
    const step = mutable.get(planStep.stepId)!
    const requestBodyKeys = Object.keys(step.requestBody)
    return {
      stepId: step.stepId,
      ...(step.description === undefined ? {} : { description: step.description }),
      outputs: Object.fromEntries(
        Object.entries(step.outputs).sort(([left], [right]) => left.localeCompare(right)),
      ),
      parameters: [...step.parameters.values()].sort(
        (left, right) =>
          left.in.localeCompare(right.in) ||
          left.name.toLowerCase().localeCompare(right.name.toLowerCase()),
      ),
      ...(requestBodyKeys.length === 0
        ? {}
        : { requestBody: { contentType: 'application/json', payload: step.requestBody } }),
      dependsOn: [...step.dependsOn].sort(
        (left, right) =>
          (indexes.get(left) ?? 0) - (indexes.get(right) ?? 0) || left.localeCompare(right),
      ),
    }
  })

  return { steps, diagnostics: sortDiagnostics(diagnostics) }
}
