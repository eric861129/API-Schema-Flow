import type {
  NormalizedArazzoDocument,
  NormalizedArazzoExpressionValue,
  NormalizedArazzoObjectValue,
  NormalizedArazzoStep,
  NormalizedArazzoTemplateValue,
  NormalizedArazzoValue,
} from '@api-schema-flow/arazzo'
import type {
  NormalizedApiDocument,
  NormalizedLink,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedResponse,
  SourcePointer,
} from '@api-schema-flow/domain'

import type { FlowArazzoSource, FlowOpenApiSource } from '../../src/index.js'

const OPENAPI_URI = 'memory://reservation-openapi'
const ARAZZO_URI = 'file:///reservation-workflow.yaml'

export function pointer(uri: string, value: string): SourcePointer {
  return { uri, pointer: value }
}

function operation(
  method: NormalizedOperation['method'],
  path: string,
  operationId: string,
  parameters: readonly NormalizedParameter[] = [],
  responses: readonly NormalizedResponse[] = [],
): NormalizedOperation {
  return {
    id: `operation:${method}:${path}`,
    operationId,
    method,
    path,
    tags: [],
    deprecated: false,
    parameters,
    responses,
    security: [],
    servers: [],
    source: pointer(OPENAPI_URI, `#/paths/${path.replaceAll('~', '~0').replaceAll('/', '~1')}/${method}`),
  }
}

function response(operationPath: string, statusCode: string, links: readonly NormalizedLink[] = []): NormalizedResponse {
  return {
    statusCode,
    description: 'Synthetic response',
    content: [],
    links,
    source: pointer(OPENAPI_URI, `${operationPath}/responses/${statusCode}`),
  }
}

export function createReservationOpenApiSource(options: { readonly includeLink?: boolean } = {}): FlowOpenApiSource {
  const createPath = '#/paths/~1reservations/post'
  const link: NormalizedLink = {
    name: 'GetReservation',
    target: { type: 'operationId', operationId: 'getReservation' },
    resolvedOperationKey: 'operation:get:/reservations/{id}',
    parameters: [{ target: 'id', expression: '$response.body#/id' }],
    source: pointer(OPENAPI_URI, `${createPath}/responses/201/links/GetReservation`),
  }
  const idParameter: NormalizedParameter = {
    name: 'id',
    location: 'path',
    required: true,
    deprecated: false,
    source: pointer(OPENAPI_URI, '#/paths/~1reservations~1{id}/get/parameters/0'),
  }

  const operations = [
    operation('post', '/auth/login', 'login', [], [
      response('#/paths/~1auth~1login/post', '200'),
    ]),
    operation('get', '/spaces/available', 'listAvailableSpaces', [], [
      response('#/paths/~1spaces~1available/get', '200'),
    ]),
    operation('post', '/reservations', 'createReservation', [], [
      response(createPath, '201', options.includeLink ? [link] : []),
    ]),
    operation('get', '/reservations/{id}', 'getReservation', [idParameter], [
      response('#/paths/~1reservations~1{id}/get', '200'),
    ]),
  ]

  const document: NormalizedApiDocument = {
    schemaVersion: '1.0',
    sourceUri: OPENAPI_URI,
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'Reservation API', version: '1.0.0' },
    tags: [],
    servers: [],
    operations,
    componentSchemas: [],
  }

  return {
    sourceId: 'reservationApi',
    sourceName: 'reservationApi',
    document,
  }
}

function preserved(source: SourcePointer) {
  return { source, extensions: {}, preservedFields: {} }
}

function responseBodyExpression(raw: string, pointerValue: string, source: SourcePointer): NormalizedArazzoExpressionValue {
  return {
    kind: 'expression',
    expression: {
      kind: 'http',
      raw,
      message: 'response',
      location: 'body',
      pointer: pointerValue,
      source,
    },
    source,
  }
}

function stepOutputExpression(stepId: string, outputName: string, source: SourcePointer): NormalizedArazzoExpressionValue {
  return {
    kind: 'expression',
    expression: {
      kind: 'step-output',
      raw: `$steps.${stepId}.outputs.${outputName}`,
      stepId,
      outputName,
      source,
    },
    source,
  }
}

function bearerTemplate(stepId: string, outputName: string, source: SourcePointer): NormalizedArazzoTemplateValue {
  const expression = {
    kind: 'step-output' as const,
    raw: `$steps.${stepId}.outputs.${outputName}`,
    stepId,
    outputName,
    source,
  }
  return {
    kind: 'template',
    template: {
      kind: 'template',
      raw: `Bearer {$steps.${stepId}.outputs.${outputName}}`,
      segments: [
        { kind: 'literal', value: 'Bearer ' },
        { kind: 'expression', expression },
      ],
      source,
    },
    source,
  }
}

function emptyObject(source: SourcePointer): NormalizedArazzoObjectValue {
  return { kind: 'object', properties: {}, source }
}

function step(
  index: number,
  stepId: string,
  operationId: string,
  options: {
    readonly dependsOn?: readonly string[]
    readonly parameters?: readonly NormalizedArazzoStep['parameters'][number][]
    readonly requestBody?: NormalizedArazzoStep['requestBody']
    readonly outputs?: Readonly<Record<string, NormalizedArazzoValue>>
  } = {},
): NormalizedArazzoStep {
  const source = pointer(ARAZZO_URI, `#/workflows/0/steps/${index}`)
  return {
    ...preserved(source),
    stepId,
    targets: [{ type: 'operationId', operationId }],
    parameters: options.parameters ?? [],
    ...(options.requestBody === undefined ? {} : { requestBody: options.requestBody }),
    successCriteria: [],
    onSuccess: [],
    onFailure: [],
    outputs: options.outputs ?? {},
    dependsOn: options.dependsOn ?? [],
  }
}

export function createReservationArazzoSource(): FlowArazzoSource {
  const loginOutputSource = pointer(ARAZZO_URI, '#/workflows/0/steps/0/outputs/token')
  const listAuthSource = pointer(ARAZZO_URI, '#/workflows/0/steps/1/parameters/0/value')
  const listOutputSource = pointer(ARAZZO_URI, '#/workflows/0/steps/1/outputs/spaceId')
  const createAuthSource = pointer(ARAZZO_URI, '#/workflows/0/steps/2/parameters/0/value')
  const createBodySource = pointer(ARAZZO_URI, '#/workflows/0/steps/2/requestBody/payload/spaceId')
  const createOutputSource = pointer(ARAZZO_URI, '#/workflows/0/steps/2/outputs/reservationId')
  const getIdSource = pointer(ARAZZO_URI, '#/workflows/0/steps/3/parameters/0/value')
  const getAuthSource = pointer(ARAZZO_URI, '#/workflows/0/steps/3/parameters/1/value')

  const steps = [
    step(0, 'login', 'login', {
      outputs: {
        token: responseBodyExpression('$response.body#/token', '#/token', loginOutputSource),
      },
    }),
    step(1, 'listSpaces', 'listAvailableSpaces', {
      dependsOn: ['login'],
      parameters: [
        {
          ...preserved(pointer(ARAZZO_URI, '#/workflows/0/steps/1/parameters/0')),
          name: 'Authorization',
          location: 'header',
          value: bearerTemplate('login', 'token', listAuthSource),
        },
      ],
      outputs: {
        spaceId: responseBodyExpression('$response.body#/0/id', '#/0/id', listOutputSource),
      },
    }),
    step(2, 'createReservation', 'createReservation', {
      dependsOn: ['listSpaces'],
      parameters: [
        {
          ...preserved(pointer(ARAZZO_URI, '#/workflows/0/steps/2/parameters/0')),
          name: 'Authorization',
          location: 'header',
          value: bearerTemplate('login', 'token', createAuthSource),
        },
      ],
      requestBody: {
        ...preserved(pointer(ARAZZO_URI, '#/workflows/0/steps/2/requestBody')),
        contentType: 'application/json',
        payload: {
          kind: 'object',
          properties: {
            spaceId: stepOutputExpression('listSpaces', 'spaceId', createBodySource),
          },
          source: pointer(ARAZZO_URI, '#/workflows/0/steps/2/requestBody/payload'),
        },
      },
      outputs: {
        reservationId: responseBodyExpression(
          '$response.body#/id',
          '#/id',
          createOutputSource,
        ),
      },
    }),
    step(3, 'getReservation', 'getReservation', {
      dependsOn: ['createReservation'],
      parameters: [
        {
          ...preserved(pointer(ARAZZO_URI, '#/workflows/0/steps/3/parameters/0')),
          name: 'id',
          location: 'path',
          value: stepOutputExpression('createReservation', 'reservationId', getIdSource),
        },
        {
          ...preserved(pointer(ARAZZO_URI, '#/workflows/0/steps/3/parameters/1')),
          name: 'Authorization',
          location: 'header',
          value: bearerTemplate('login', 'token', getAuthSource),
        },
      ],
    }),
  ]

  const root = pointer(ARAZZO_URI, '#')
  const document: NormalizedArazzoDocument = {
    ...preserved(root),
    schemaVersion: '1.0',
    sourceUri: ARAZZO_URI,
    arazzoVersion: '1.1.0',
    info: {
      ...preserved(pointer(ARAZZO_URI, '#/info')),
      title: 'Reservation workflow',
      version: '1.0.0',
    },
    sourceDescriptions: [
      {
        ...preserved(pointer(ARAZZO_URI, '#/sourceDescriptions/0')),
        name: 'reservationApi',
        url: './openapi.yaml',
        resolvedUri: 'file:///openapi.yaml',
        type: 'openapi',
      },
    ],
    workflows: [
      {
        ...preserved(pointer(ARAZZO_URI, '#/workflows/0')),
        workflowId: 'createReservation',
        parameters: [],
        steps,
        successActions: [],
        failureActions: [],
        outputs: {},
      },
    ],
    components: emptyObject(pointer(ARAZZO_URI, '#/components')),
  }

  return {
    sourceId: 'reservationWorkflow',
    retrievalUri: ARAZZO_URI,
    document,
  }
}
