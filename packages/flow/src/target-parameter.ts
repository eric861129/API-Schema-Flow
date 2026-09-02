import type {
  FlowValueTarget,
  NormalizedOperation,
  NormalizedParameter,
  ParameterLocation,
} from '@api-schema-flow/domain'

const QUALIFIED_TARGET = /^(path|query|querystring|header|cookie)\.(.+)$/u

function parameterNameMatches(
  parameter: NormalizedParameter,
  location: ParameterLocation,
  name: string,
): boolean {
  if (parameter.location !== location) return false
  return location === 'header'
    ? parameter.name.toLowerCase() === name.toLowerCase()
    : parameter.name === name
}

function parameterToTarget(parameter: NormalizedParameter): FlowValueTarget {
  switch (parameter.location) {
    case 'path':
      return { kind: 'path-parameter', name: parameter.name }
    case 'query':
      return { kind: 'query-parameter', name: parameter.name }
    case 'querystring':
      return { kind: 'querystring-parameter', name: parameter.name }
    case 'header':
      return { kind: 'header-parameter', name: parameter.name }
    case 'cookie':
      return { kind: 'cookie-parameter', name: parameter.name }
  }
}

export function matchingLinkParameterTargets(
  operation: NormalizedOperation,
  target: string,
): readonly FlowValueTarget[] {
  const qualified = QUALIFIED_TARGET.exec(target)
  if (qualified) {
    const location = qualified[1] as ParameterLocation
    const name = qualified[2]!
    return operation.parameters
      .filter((parameter) => parameterNameMatches(parameter, location, name))
      .map(parameterToTarget)
  }

  return operation.parameters
    .filter((parameter) =>
      parameter.location === 'header'
        ? parameter.name.toLowerCase() === target.toLowerCase()
        : parameter.name === target,
    )
    .map(parameterToTarget)
}

export function resolveLinkParameterTarget(
  operation: NormalizedOperation,
  target: string,
): FlowValueTarget | undefined {
  const matches = matchingLinkParameterTargets(operation, target)
  return matches.length === 1 ? matches[0] : undefined
}

export function arazzoParameterTarget(
  location: string,
  name: string,
): FlowValueTarget | undefined {
  switch (location) {
    case 'path':
      return { kind: 'path-parameter', name }
    case 'query':
      return { kind: 'query-parameter', name }
    case 'querystring':
      return { kind: 'querystring-parameter', name }
    case 'header':
      return { kind: 'header-parameter', name }
    case 'cookie':
      return { kind: 'cookie-parameter', name }
    default:
      return undefined
  }
}
