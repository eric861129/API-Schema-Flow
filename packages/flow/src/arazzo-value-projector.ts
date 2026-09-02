import type {
  NormalizedArazzoValue,
  NormalizedArazzoWorkflow,
  RuntimeExpression,
} from '@api-schema-flow/arazzo'
import {
  escapeJsonPointerToken,
  type FlowValueSelector,
  type FlowValueTransform,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import type {
  ArazzoStepOutputUse,
  ResolvedArazzoOutputSelector,
  TargetedArazzoStepOutputUse,
} from './contracts.js'
import { runtimeExpressionToSelector } from './expression-selector.js'

function expressionUse(
  expression: RuntimeExpression,
  source: NormalizedArazzoValue['source'],
  transform?: FlowValueTransform,
): ArazzoStepOutputUse | undefined {
  if (expression.kind !== 'step-output') return undefined
  return {
    stepId: expression.stepId,
    outputName: expression.outputName,
    source: expression.source ?? source,
    ...(transform === undefined ? {} : { transform }),
  }
}

function collectUses(value: NormalizedArazzoValue, uses: ArazzoStepOutputUse[]): void {
  switch (value.kind) {
    case 'expression': {
      const use = expressionUse(value.expression, value.source)
      if (use !== undefined) uses.push(use)
      return
    }
    case 'template': {
      const transform: FlowValueTransform = { kind: 'template', raw: value.template.raw }
      for (const segment of value.template.segments) {
        if (segment.kind !== 'expression') continue
        const use = expressionUse(segment.expression, value.source, transform)
        if (use !== undefined) uses.push(use)
      }
      return
    }
    case 'array':
      for (const item of value.items) collectUses(item, uses)
      return
    case 'object':
      for (const [, nested] of Object.entries(value.properties).sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        collectUses(nested, uses)
      }
      return
    case 'literal':
      return
  }
}

function useKey(use: ArazzoStepOutputUse): string {
  return [
    use.stepId,
    use.outputName,
    use.source.uri,
    use.source.pointer,
    use.transform?.raw ?? '',
  ].join('\u0000')
}

export function collectArazzoStepOutputUses(
  value: NormalizedArazzoValue,
): readonly ArazzoStepOutputUse[] {
  const uses: ArazzoStepOutputUse[] = []
  collectUses(value, uses)
  return uses.sort((left, right) => useKey(left).localeCompare(useKey(right)))
}

function appendBodyPointer(pointer: string, token: string): string {
  const escaped = escapeJsonPointerToken(token)
  return pointer === '#' ? `#/${escaped}` : `${pointer}/${escaped}`
}

function collectTargeted(
  value: NormalizedArazzoValue,
  targetPointer: string,
  result: TargetedArazzoStepOutputUse[],
): void {
  const directUses =
    value.kind === 'expression' || value.kind === 'template'
      ? collectArazzoStepOutputUses(value)
      : []
  for (const use of directUses) result.push({ ...use, targetPointer })

  if (value.kind === 'array') {
    value.items.forEach((item, index) =>
      collectTargeted(item, appendBodyPointer(targetPointer, String(index)), result),
    )
    return
  }
  if (value.kind === 'object') {
    for (const [key, nested] of Object.entries(value.properties).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      collectTargeted(nested, appendBodyPointer(targetPointer, key), result)
    }
  }
}

export function collectTargetedArazzoStepOutputUses(
  value: NormalizedArazzoValue,
  targetPointer = '#',
): readonly TargetedArazzoStepOutputUse[] {
  const result: TargetedArazzoStepOutputUse[] = []
  collectTargeted(value, targetPointer, result)
  return result.sort(
    (left, right) =>
      left.targetPointer.localeCompare(right.targetPointer) ||
      useKey(left).localeCompare(useKey(right)),
  )
}

function outputDiagnostic(
  workflow: NormalizedArazzoWorkflow,
  stepId: string,
  outputName: string,
  code: string,
  message: string,
  source = workflow.source,
): Diagnostic {
  return {
    code,
    severity: 'error',
    message,
    source,
    details: { workflowId: workflow.workflowId, stepId, outputName },
  }
}

function selectorFromOutputValue(value: NormalizedArazzoValue): {
  readonly selector?: FlowValueSelector
  readonly transform?: FlowValueTransform
} {
  if (value.kind === 'expression') {
    const selector = runtimeExpressionToSelector(value.expression)
    return selector === undefined ? {} : { selector }
  }

  if (value.kind === 'template') {
    const expressions = value.template.segments.flatMap((segment) =>
      segment.kind === 'expression' ? [segment.expression] : [],
    )
    if (expressions.length !== 1) return {}
    const selector = runtimeExpressionToSelector(expressions[0]!)
    return selector === undefined
      ? {}
      : {
          selector,
          transform: { kind: 'template', raw: value.template.raw },
        }
  }

  return {}
}

export function resolveArazzoStepOutputSelector(
  workflow: NormalizedArazzoWorkflow,
  stepId: string,
  outputName: string,
): ResolvedArazzoOutputSelector {
  const step = workflow.steps.find((candidate) => candidate.stepId === stepId)
  if (step === undefined) {
    return {
      sourcePointers: [],
      diagnostics: [
        outputDiagnostic(
          workflow,
          stepId,
          outputName,
          DIAGNOSTIC_CODES.FLOW_WORKFLOW_REFERENCE_MISSING,
          `Workflow "${workflow.workflowId}" references missing step "${stepId}".`,
        ),
      ],
    }
  }

  if (!Object.hasOwn(step.outputs, outputName)) {
    return {
      sourcePointers: [],
      diagnostics: [
        outputDiagnostic(
          workflow,
          stepId,
          outputName,
          DIAGNOSTIC_CODES.FLOW_WORKFLOW_REFERENCE_MISSING,
          `Step "${stepId}" does not declare output "${outputName}".`,
          step.source,
        ),
      ],
    }
  }

  const value = step.outputs[outputName]!
  const projected = selectorFromOutputValue(value)
  if (projected.selector === undefined) {
    return {
      sourcePointers: [value.source],
      diagnostics: [
        outputDiagnostic(
          workflow,
          stepId,
          outputName,
          DIAGNOSTIC_CODES.FLOW_PROJECTION_UNSUPPORTED,
          `Step output "${stepId}.${outputName}" cannot be represented as one structural selector.`,
          value.source,
        ),
      ],
    }
  }

  return {
    selector: projected.selector,
    ...(projected.transform === undefined ? {} : { transform: projected.transform }),
    sourcePointers: [value.source],
    diagnostics: sortDiagnostics([]),
  }
}
