import { expect, test } from 'vitest'
import raw from '../../public/fixtures/reservation-workspace.json'

import type { WorkspaceSnapshot } from '../data/types'
import type { WorkflowDraft } from './workflow-draft'
import { exportWorkflowDraft } from './workflow-export'

const snapshot = raw as unknown as WorkspaceSnapshot
const create = snapshot.acceptedGraph.nodes.find(
  (node) => node.kind === 'endpoint' && node.operationKey === 'operation:post:/reservations',
)!
const read = snapshot.acceptedGraph.nodes.find(
  (node) => node.kind === 'endpoint' && node.operationKey === 'operation:get:/reservations/{id}',
)!
const relation = snapshot.acceptedGraph.edges.find(
  (edge) => edge.sourceNodeId === create.id && edge.targetNodeId === read.id,
)!
const draft: WorkflowDraft = {
  schemaVersion: '1.0',
  workflowId: 'createReservation',
  summary: 'Create and retrieve a reservation',
  sourceUrl: './openapi.yaml',
  steps: [
    { stepId: 'create', operationNodeId: create.id },
    { stepId: 'get', operationNodeId: read.id },
  ],
  selectedMappings: [{ edgeId: relation.id, mappingId: relation.mappings[0]!.id }],
}

test('exports chosen steps and accepted field bindings as parser-valid Arazzo', async () => {
  const artifact = await exportWorkflowDraft(snapshot, snapshot.acceptedGraph, draft, 'json')
  expect(artifact.diagnostics.filter((item) => item.severity === 'error')).toEqual([])
  expect(artifact.fileName).toBe('createreservation.arazzo.json')
  expect(JSON.parse(artifact.contents)).toMatchObject({
    arazzo: '1.1.0',
    sourceDescriptions: [{ name: 'api', url: './openapi.yaml', type: 'openapi' }],
    workflows: [
      {
        workflowId: 'createReservation',
        steps: [
          {
            stepId: 'create',
            operationId: 'createReservation',
            outputs: { id: '$response.body#/id' },
          },
          {
            stepId: 'get',
            operationId: 'getReservation',
            dependsOn: ['create'],
            parameters: [{ name: 'id', in: 'path', value: '$steps.create.outputs.id' }],
          },
        ],
      },
    ],
  })
})

test('does not export a mapping that is no longer accepted', async () => {
  const withoutRelation = {
    ...snapshot.acceptedGraph,
    edges: snapshot.acceptedGraph.edges.filter((edge) => edge.id !== relation.id),
  }
  const artifact = await exportWorkflowDraft(snapshot, withoutRelation, draft, 'json')
  expect(artifact.contents).toBe('')
  expect(artifact.diagnostics.some((item) => item.severity === 'error')).toBe(true)
})

test('does not leak accepted mappings that the user did not select', async () => {
  const artifact = await exportWorkflowDraft(
    snapshot,
    snapshot.acceptedGraph,
    { ...draft, selectedMappings: [] },
    'json',
  )
  expect(artifact.diagnostics.filter((item) => item.severity === 'error')).toEqual([])
  const steps = JSON.parse(artifact.contents).workflows[0].steps
  expect(steps[0].outputs).toBeUndefined()
  expect(steps[1].parameters).toBeUndefined()
  expect(steps[1].dependsOn).toBeUndefined()
})
