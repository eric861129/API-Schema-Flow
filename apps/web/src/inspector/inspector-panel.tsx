import type {
  EndpointFlowNode,
  FlowEdge,
  FlowValueSelector,
  FlowValueTarget,
  NormalizedOperation,
  NormalizedSchema,
} from '@api-schema-flow/domain'

import { MethodBadge } from '../components/operations-panel'
import type { SelectedElement, WorkspaceSnapshot } from '../data/types'

function schemaText(schema: NormalizedSchema | undefined): string {
  if (!schema) return 'No schema declared'
  if (schema.types.includes('array')) return 'array of ' + schemaText(schema.items)

  const properties = Object.keys(schema.properties)
  const type = schema.types.join(' | ') || 'unknown'
  return properties.length > 0
    ? type + ' · ' + properties.join(', ')
    : schema.format
      ? type + ' · ' + schema.format
      : type
}

function selectorText(value: FlowValueSelector | FlowValueTarget): string {
  switch (value.kind) {
    case 'request-body':
    case 'response-body':
      return value.kind + ' ' + value.pointer
    case 'request-header':
    case 'request-query':
    case 'request-path':
    case 'response-header':
    case 'workflow-input':
    case 'path-parameter':
    case 'query-parameter':
    case 'querystring-parameter':
    case 'header-parameter':
    case 'cookie-parameter':
      return value.kind + '.' + value.name
    case 'status-code':
      return 'status-code'
    case 'literal':
      return 'literal ' + String(value.value)
  }
}

function isEndpointNode(
  node: WorkspaceSnapshot['acceptedGraph']['nodes'][number],
): node is EndpointFlowNode {
  return node.kind === 'endpoint'
}

function NodeInspector({
  operation,
  snapshot,
  onSelect,
}: {
  readonly operation: NormalizedOperation
  readonly snapshot: WorkspaceSnapshot
  readonly onSelect: (selected: SelectedElement) => void
}) {
  const node = snapshot.acceptedGraph.nodes
    .filter(isEndpointNode)
    .find((item) => item.operationKey === operation.id)
  const connections = snapshot.acceptedGraph.edges.filter(
    (edge) => edge.sourceNodeId === node?.id || edge.targetNodeId === node?.id,
  )
  return (
    <>
      <div className="inspector-title">
        <MethodBadge method={operation.method} />
        <code>{operation.path}</code>
      </div>
      <p className="inspector-summary">{operation.summary ?? operation.operationId}</p>
      <section>
        <h3>Overview</h3>
        <dl>
          <div>
            <dt>Operation ID</dt>
            <dd>{operation.operationId ?? 'Not declared'}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{operation.tags.join(', ') || 'Untagged'}</dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>{operation.security.length > 0 ? 'Required' : 'Public'}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <code>{operation.source.pointer}</code>
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>Request</h3>
        {operation.parameters.length === 0 && !operation.requestBody ? (
          <p className="muted">No request payload.</p>
        ) : null}
        {operation.parameters.map((parameter) => (
          <div className="schema-line" key={parameter.location + parameter.name}>
            <strong>
              {parameter.location}.{parameter.name}
            </strong>
            <span>{schemaText(parameter.schema)}</span>
          </div>
        ))}
        {operation.requestBody?.content.map((media) => (
          <div className="schema-line" key={media.mediaType}>
            <strong>{media.mediaType}</strong>
            <span>{schemaText(media.schema)}</span>
          </div>
        ))}
      </section>
      <section>
        <h3>Responses</h3>
        {operation.responses.map((response) => (
          <div className="response-line" key={response.statusCode}>
            <strong>{response.statusCode}</strong>
            <span>{response.description}</span>
            <small>{response.content.map((media) => schemaText(media.schema)).join(' · ')}</small>
          </div>
        ))}
      </section>
      <section>
        <h3>Connections</h3>
        {connections.length === 0 ? (
          <p className="muted">No accepted relationships.</p>
        ) : (
          connections.map((edge) => (
            <button
              className="connection-row"
              key={edge.id}
              onClick={() => onSelect({ kind: 'edge', id: edge.id })}
            >
              <span>{edge.sourceNodeId === node?.id ? 'Outgoing' : 'Incoming'}</span>
              <strong>
                {edge.mappings[0]
                  ? selectorText(edge.mappings[0].source) +
                    ' → ' +
                    selectorText(edge.mappings[0].target)
                  : edge.kind}
              </strong>
              <small>{edge.provenance}</small>
            </button>
          ))
        )}
      </section>
    </>
  )
}

function EdgeInspector({
  edge,
  snapshot,
}: {
  readonly edge: FlowEdge
  readonly snapshot: WorkspaceSnapshot
}) {
  const operationByNode = new Map(
    snapshot.acceptedGraph.nodes
      .filter(isEndpointNode)
      .map((node) => [
        node.id,
        snapshot.apiDocument.operations.find((operation) => operation.id === node.operationKey),
      ]),
  )
  const source = operationByNode.get(edge.sourceNodeId)
  const target = operationByNode.get(edge.targetNodeId)
  const action = edge.provenance === 'manual' ? 'edit' : 'accept'

  return (
    <>
      <div className="edge-heading">
        <span className={'provenance-token provenance-' + edge.provenance}>
          {edge.provenance === 'inferred'
            ? 'Accepted inferred'
            : edge.provenance === 'manual'
              ? 'Manual'
              : 'Declared'}
        </span>
        <span className="accepted-token">Accepted</span>
      </div>
      <section>
        <h3>Source</h3>
        <strong>
          {source?.method.toUpperCase()} {source?.path}
        </strong>
        <code className="block-code">
          {edge.mappings[0] ? selectorText(edge.mappings[0].source) : 'No mapping'}
        </code>
      </section>
      <section>
        <h3>Target</h3>
        <strong>
          {target?.method.toUpperCase()} {target?.path}
        </strong>
        <code className="block-code">
          {edge.mappings[0] ? selectorText(edge.mappings[0].target) : 'No mapping'}
        </code>
      </section>
      <section>
        <h3>Review evidence</h3>
        {edge.review ? (
          <>
            <dl>
              <div>
                <dt>Action</dt>
                <dd>{action}</dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd>
                  <code>{edge.review.decisionId}</code>
                </dd>
              </div>
              {edge.review.candidateId ? (
                <div>
                  <dt>Candidate</dt>
                  <dd>
                    <code>{edge.review.candidateId}</code>
                  </dd>
                </div>
              ) : null}
            </dl>
            <ul className="evidence-list">
              {edge.review.evidenceRuleIds.map((rule) => (
                <li key={rule}>✓ {rule}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Declared by the source specification.</p>
        )}
      </section>
      <section>
        <h3>Relationship ID</h3>
        <code className="block-code">{edge.id}</code>
      </section>
    </>
  )
}

export function InspectorPanel({
  snapshot,
  selected,
  onClose,
  onSelect,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly selected: Exclude<SelectedElement, null>
  readonly onClose: () => void
  readonly onSelect: (selected: SelectedElement) => void
}) {
  const node =
    selected.kind === 'node'
      ? snapshot.acceptedGraph.nodes.filter(isEndpointNode).find((item) => item.id === selected.id)
      : undefined
  const operation = node
    ? snapshot.apiDocument.operations.find((item) => item.id === node.operationKey)
    : undefined
  const edge =
    selected.kind === 'edge'
      ? snapshot.acceptedGraph.edges.find((item) => item.id === selected.id)
      : undefined
  return (
    <aside
      className="inspector-panel"
      aria-label={selected.kind === 'node' ? 'Endpoint inspector' : 'Relationship inspector'}
    >
      <header className="panel-heading">
        <div>
          <span className="eyebrow">INSPECTOR</span>
          <strong>{selected.kind === 'node' ? 'Endpoint' : 'Relationship'}</strong>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </header>
      <div className="inspector-scroll">
        {operation ? (
          <NodeInspector operation={operation} snapshot={snapshot} onSelect={onSelect} />
        ) : edge ? (
          <EdgeInspector edge={edge} snapshot={snapshot} />
        ) : (
          <p>Selection is no longer available.</p>
        )}
      </div>
    </aside>
  )
}
