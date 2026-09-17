import { useEffect, useMemo, useRef, useState } from 'react'

import type { FlowDataMapping, FlowGraph } from '@api-schema-flow/domain'
import type { ArazzoExportArtifact } from '@api-schema-flow/exporter-arazzo'
import {
  executeLocalMockWorkflow,
  type LocalMockPlan,
  type LocalMockRun,
} from '@api-schema-flow/execution'
import type { InMemoryMockSession } from '@api-schema-flow/mock-runtime'

import type { WorkspaceSnapshot } from '../data/types'
import { useI18n } from '../i18n'
import { createWorkflowDraft, type WorkflowDraft, type WorkflowStepDraft } from './workflow-draft'
import { exportWorkflowDraft } from './workflow-export'
import { prepareWorkflowRun } from './workflow-run'

interface WorkflowEditorProps {
  readonly snapshot: WorkspaceSnapshot
  readonly graph: FlowGraph
  readonly draft: WorkflowDraft | undefined
  readonly mockSession: InMemoryMockSession
  readonly onChange: (draft: WorkflowDraft) => void
}

function mappingLabel(mapping: FlowDataMapping, translate: (value: string) => string): string {
  const source =
    'pointer' in mapping.source
      ? mapping.source.pointer
      : 'name' in mapping.source
        ? mapping.source.name
        : mapping.source.kind
  const target = 'pointer' in mapping.target ? mapping.target.pointer : mapping.target.name
  return `${translate(mapping.source.kind)} ${source} → ${translate(mapping.target.kind)} ${target}`
}

function validMappings(graph: FlowGraph, steps: readonly WorkflowStepDraft[]) {
  const positions = new Map(steps.map((step, index) => [step.operationNodeId, index]))
  return graph.edges.filter((edge) => {
    if (edge.kind !== 'data' || edge.status !== 'accepted' || !edge.mappings.length) return false
    const source = positions.get(edge.sourceNodeId)
    const target = positions.get(edge.targetNodeId)
    return source !== undefined && target !== undefined && source < target
  })
}

function stepName(nodeId: string, snapshot: WorkspaceSnapshot): string {
  const node = snapshot.acceptedGraph.nodes.find((item) => item.id === nodeId)
  if (node?.kind !== 'endpoint') return nodeId
  const operation = snapshot.apiDocument.operations.find((item) => item.id === node.operationKey)
  return operation ? `${operation.method.toUpperCase()} ${operation.path}` : node.operationKey
}

function sampleRequest(plan: LocalMockPlan): string {
  const schema = plan.create.requestBody?.content.find(
    (item) => item.mediaType === 'application/json',
  )?.schema
  const body: Record<string, unknown> = {}
  for (const name of schema?.required ?? []) {
    const field = schema?.properties[name]
    if (!field) continue
    body[name] =
      field.format === 'uuid'
        ? '11111111-1111-4111-8111-111111111111'
        : field.format === 'date-time'
          ? name.toLowerCase().includes('end')
            ? '2026-09-18T10:00:00Z'
            : '2026-09-18T09:00:00Z'
          : (field.enumValues[0] ??
            (field.types.includes('integer') || field.types.includes('number')
              ? 1
              : field.types.includes('boolean')
                ? true
                : 'example'))
  }
  return JSON.stringify(body, null, 2)
}

/** 以明確排序的端點與已接受映射建立單一 Arazzo Workflow 草稿。 */
export function WorkflowEditor({
  snapshot,
  graph,
  draft,
  mockSession,
  onChange,
}: WorkflowEditorProps) {
  const { t, localize, locale } = useI18n()
  const [search, setSearch] = useState('')
  const [chosenNodeId, setChosenNodeId] = useState('')
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml')
  const [artifact, setArtifact] = useState<{
    readonly value: ArazzoExportArtifact
    readonly draft: WorkflowDraft
    readonly graph: FlowGraph
    readonly format: 'yaml' | 'json'
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [prepared, setPrepared] = useState<{
    readonly draft: WorkflowDraft
    readonly graph: FlowGraph
    readonly plan?: LocalMockPlan
    readonly reason?: string
  } | null>(null)
  const [requestBody, setRequestBody] = useState('{}')
  const [runResult, setRunResult] = useState<LocalMockRun | null>(null)
  const [sessionSummary, setSessionSummary] = useState(mockSession.summary)
  const request = useRef(0)
  const operations = useMemo(() => {
    const byId = new Map(
      snapshot.apiDocument.operations.map((operation) => [operation.id, operation]),
    )
    return graph.nodes.flatMap((node) => {
      if (node.kind !== 'endpoint') return []
      const operation = byId.get(node.operationKey)
      if (!operation) return []
      return [
        {
          nodeId: node.id,
          label: `${operation.method.toUpperCase()} ${operation.path}`,
          operationId: operation.operationId ?? '',
        },
      ]
    })
  }, [graph.nodes, snapshot.apiDocument.operations])
  const available = operations.filter((operation) =>
    `${operation.label} ${operation.operationId}`.toLowerCase().includes(search.toLowerCase()),
  )
  const eligibleEdges = draft ? validMappings(graph, draft.steps) : []
  const eligibleIds = new Set(
    eligibleEdges.flatMap((edge) =>
      edge.mappings.map((mapping) => `${edge.id}\u0000${mapping.id}`),
    ),
  )
  const selectedCount =
    draft?.selectedMappings.filter(({ edgeId, mappingId }) =>
      eligibleIds.has(`${edgeId}\u0000${mappingId}`),
    ).length ?? 0
  const unavailableMappings =
    draft?.selectedMappings.filter(
      ({ edgeId, mappingId }) => !eligibleIds.has(`${edgeId}\u0000${mappingId}`),
    ) ?? []
  const currentArtifact =
    artifact && artifact.draft === draft && artifact.graph === graph && artifact.format === format
      ? artifact.value
      : null
  const errors =
    currentArtifact?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error') ?? []
  const currentPlan =
    prepared && prepared.draft === draft && prepared.graph === graph ? prepared.plan : undefined
  const currentReason =
    prepared && prepared.draft === draft && prepared.graph === graph
      ? prepared.reason
      : 'Checking Local Mock readiness…'

  useEffect(() => {
    let cancelled = false
    if (!draft) return
    const timer = window.setTimeout(() => {
      void prepareWorkflowRun(snapshot, graph, draft)
        .then((result) => {
          if (!cancelled) setPrepared({ ...result, draft, graph })
        })
        .catch(() => {
          if (!cancelled)
            setPrepared({ draft, graph, reason: 'Local Mock readiness check failed.' })
        })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [draft, graph, snapshot])

  useEffect(() => {
    setRunResult(null)
  }, [draft])

  useEffect(() => {
    setSessionSummary(mockSession.summary)
    setRunResult(null)
  }, [mockSession])

  useEffect(() => {
    request.current += 1
    setArtifact(null)
    setBusy(false)
    setRunResult(null)
  }, [graph])

  function update(next: WorkflowDraft) {
    request.current += 1
    setArtifact(null)
    setBusy(false)
    setRunResult(null)
    onChange(next)
  }

  function runMock() {
    if (!currentPlan || requestBody.length > 65_536) return
    let body: unknown
    try {
      body = JSON.parse(requestBody) as unknown
    } catch {
      setRunResult({
        status: 'failed',
        trace: [],
        sameEntity: false,
        reason: 'Enter valid JSON for the POST request body.',
      })
      return
    }
    setRunResult(executeLocalMockWorkflow(currentPlan, body, mockSession))
    setSessionSummary(mockSession.summary)
  }

  function displayRunReason(reason: string): string {
    const required = reason.match(/^Required request field "(.+)" is missing\.$/u)
    if (required) return t('Required request field "{{name}}" is missing.', { name: required[1] })
    const invalid = reason.match(/^Request field "(.+)" has an invalid value\.$/u)
    if (invalid) return t('Request field "{{name}}" has an invalid value.', { name: invalid[1] })
    const unknown = reason.match(/^Unknown request field "(.+)"\.$/u)
    if (unknown) return t('Unknown request field "{{name}}".', { name: unknown[1] })
    const unsupported = reason.match(/^Local Mock cannot validate request field "(.+)"\.$/u)
    if (unsupported)
      return t('Local Mock cannot validate request field "{{name}}".', {
        name: unsupported[1],
      })
    return localize(reason)
  }

  function updateSteps(steps: readonly WorkflowStepDraft[]) {
    if (!draft) return
    const allowed = new Set(
      validMappings(graph, steps).flatMap((edge) =>
        edge.mappings.map((mapping) => `${edge.id}\u0000${mapping.id}`),
      ),
    )
    update({
      ...draft,
      steps,
      selectedMappings: draft.selectedMappings.filter(({ edgeId, mappingId }) =>
        allowed.has(`${edgeId}\u0000${mappingId}`),
      ),
    })
  }

  function addStep() {
    if (
      !draft ||
      !chosenNodeId ||
      draft.steps.length >= 40 ||
      draft.steps.some((step) => step.operationNodeId === chosenNodeId)
    )
      return
    const used = new Set(draft.steps.map((step) => step.stepId))
    const operation = operations.find((item) => item.nodeId === chosenNodeId)
    const base = operation?.operationId.replace(/[^A-Za-z0-9_]/gu, '') || 'step'
    let stepId = base
    for (let index = 2; used.has(stepId); index += 1) stepId = `${base}${index}`
    updateSteps([...draft.steps, { stepId, operationNodeId: chosenNodeId }])
    setChosenNodeId('')
  }

  async function preview() {
    if (!draft) return
    const id = ++request.current
    setArtifact(null)
    setBusy(true)
    try {
      const value = await exportWorkflowDraft(snapshot, graph, draft, format)
      if (id === request.current) setArtifact({ value, draft, graph, format })
    } catch (reason) {
      if (id === request.current) {
        setArtifact({
          value: {
            fileName: '',
            mediaType: 'application/json',
            contents: '',
            contentHash: '',
            diagnostics: [
              {
                code: 'ASF-WEB-WORKFLOW-1002',
                severity: 'error',
                message: reason instanceof Error ? reason.message : 'Workflow preview failed.',
                source: { uri: 'memory://workflow-draft', pointer: '#' },
              },
            ],
          },
          draft,
          graph,
          format,
        })
      }
    } finally {
      if (id === request.current) setBusy(false)
    }
  }

  function download() {
    if (!currentArtifact?.contents || errors.length) return
    const url = URL.createObjectURL(
      new Blob([currentArtifact.contents], { type: currentArtifact.mediaType }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = currentArtifact.fileName
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="workflow-editor" aria-label={t('Workflow editor')}>
      <header className="workflow-editor__header">
        <div>
          <span className="eyebrow">{t('WORKFLOW')}</span>
          <h1>{t('Build an API task')}</h1>
          <p>
            {t(
              'Choose ordered operations and accepted mappings. Preview Arazzo, then run the supported create-and-read flow in Local Mock.',
            )}
          </p>
        </div>
        {!draft ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => onChange(createWorkflowDraft(snapshot))}
          >
            {t('Create workflow')}
          </button>
        ) : null}
      </header>
      {!draft ? (
        <div className="workflow-editor__empty">
          <p>{t('No workflow draft yet. Create one to arrange steps and export Arazzo.')}</p>
        </div>
      ) : (
        <div className="workflow-editor__columns">
          <div className="workflow-editor__form">
            <section className="workflow-card" aria-label={t('Workflow details')}>
              <h2>{t('Workflow details')}</h2>
              <div className="workflow-fields">
                <label>
                  {t('Workflow ID')}
                  <input
                    value={draft.workflowId}
                    maxLength={128}
                    onChange={(event) => update({ ...draft, workflowId: event.target.value })}
                  />
                </label>
                <label>
                  {t('Summary')}
                  <input
                    value={draft.summary}
                    maxLength={500}
                    onChange={(event) => update({ ...draft, summary: event.target.value })}
                  />
                </label>
                <label>
                  {t('OpenAPI source URL')}
                  <input
                    value={draft.sourceUrl}
                    maxLength={2048}
                    onChange={(event) => update({ ...draft, sourceUrl: event.target.value })}
                  />
                </label>
              </div>
              <p className="workflow-hint">
                {t(
                  'Set a URL or a relative file path that will resolve beside the downloaded Arazzo file.',
                )}
              </p>
            </section>
            <section className="workflow-card" aria-label={t('Ordered steps')}>
              <div className="workflow-card__heading">
                <h2>{t('Ordered steps')}</h2>
                <span>{draft.steps.length}/40</span>
              </div>
              <ol className="workflow-steps">
                {draft.steps.map((step, index) => (
                  <li key={step.operationNodeId}>
                    <strong className="workflow-steps__number">{index + 1}</strong>
                    <div className="workflow-steps__content">
                      <span>{stepName(step.operationNodeId, snapshot)}</span>
                      <label>
                        {t('Step ID')}
                        <input
                          aria-label={`${t('Step ID')} ${index + 1}`}
                          value={step.stepId}
                          maxLength={128}
                          onChange={(event) =>
                            updateSteps(
                              draft.steps.map((item, position) =>
                                position === index ? { ...item, stepId: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <div className="workflow-steps__actions">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`${t('Move step up')} ${index + 1}`}
                        onClick={() => {
                          const next = [...draft.steps]
                          ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
                          updateSteps(next)
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.steps.length - 1}
                        aria-label={`${t('Move step down')} ${index + 1}`}
                        onClick={() => {
                          const next = [...draft.steps]
                          ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
                          updateSteps(next)
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`${t('Remove step')} ${index + 1}`}
                        onClick={() =>
                          updateSteps(draft.steps.filter((_, position) => position !== index))
                        }
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              {draft.steps.length === 0 ? (
                <p className="workflow-hint">
                  {t(
                    'Start with a create operation, then add a read operation to follow its result.',
                  )}
                </p>
              ) : null}
              <div className="workflow-add-step">
                <label>
                  {t('Find endpoint')}
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('Search method, path or operation ID')}
                  />
                </label>
                <label>
                  {t('Endpoint')}
                  <select
                    value={chosenNodeId}
                    onChange={(event) => setChosenNodeId(event.target.value)}
                  >
                    <option value="">{t('Choose endpoint')}</option>
                    {available.map((operation) => (
                      <option
                        key={operation.nodeId}
                        value={operation.nodeId}
                        disabled={draft.steps.some(
                          (step) => step.operationNodeId === operation.nodeId,
                        )}
                      >
                        {operation.label} · {operation.operationId}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!chosenNodeId || draft.steps.length >= 40}
                  onClick={addStep}
                >
                  {t('Add step')}
                </button>
              </div>
            </section>
            <section className="workflow-card" aria-label={t('Accepted mapping bindings')}>
              <div className="workflow-card__heading">
                <h2>{t('Accepted mapping bindings')}</h2>
                <span>
                  {selectedCount}/
                  {eligibleEdges.reduce((count, edge) => count + edge.mappings.length, 0)}
                </span>
              </div>
              <p className="workflow-hint">
                {t(
                  'Only accepted mappings from an earlier step to a later step can be selected. Unselected and pending suggestions are excluded from export.',
                )}
              </p>
              {unavailableMappings.length ? (
                <div className="workflow-mapping-warning" role="alert">
                  <p>
                    {t('{{count}} selected bindings are no longer available.', {
                      count: unavailableMappings.length,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        ...draft,
                        selectedMappings: draft.selectedMappings.filter(({ edgeId, mappingId }) =>
                          eligibleIds.has(`${edgeId}\u0000${mappingId}`),
                        ),
                      })
                    }
                  >
                    {t('Remove unavailable bindings')}
                  </button>
                </div>
              ) : null}
              {eligibleEdges.length ? (
                eligibleEdges.map((edge) => (
                  <div className="workflow-mapping" key={edge.id}>
                    <strong>
                      {stepName(edge.sourceNodeId, snapshot)} →{' '}
                      {stepName(edge.targetNodeId, snapshot)}
                    </strong>
                    <small>{t(edge.provenance)}</small>
                    {edge.mappings.map((mapping) => {
                      const selected = draft.selectedMappings.some(
                        (item) => item.edgeId === edge.id && item.mappingId === mapping.id,
                      )
                      return (
                        <label key={mapping.id}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              update({
                                ...draft,
                                selectedMappings: selected
                                  ? draft.selectedMappings.filter(
                                      (item) =>
                                        item.edgeId !== edge.id || item.mappingId !== mapping.id,
                                    )
                                  : [
                                      ...draft.selectedMappings,
                                      { edgeId: edge.id, mappingId: mapping.id },
                                    ],
                              })
                            }
                          />
                          <span>{mappingLabel(mapping, (value) => t(value))}</span>
                        </label>
                      )
                    })}
                  </div>
                ))
              ) : (
                <p className="workflow-hint">
                  {t('No accepted mapping connects the current ordered steps.')}
                </p>
              )}
            </section>
            <section className="workflow-card workflow-run" aria-label={t('Local Mock and Trace')}>
              <div className="workflow-card__heading">
                <h2>{t('Local Mock and Trace')}</h2>
                <span>
                  {t('{{count}} entities in memory', { count: sessionSummary.entityCount })}
                </span>
              </div>
              <p className="workflow-hint">
                {t(
                  'Runs only in this browser session. Request body and Trace are not saved to the project or sent to an API. Authentication and business rules are not simulated.',
                )}
              </p>
              <label>
                {t('POST request JSON')}
                <textarea
                  value={requestBody}
                  maxLength={65_536}
                  spellCheck={false}
                  onChange={(event) => setRequestBody(event.target.value)}
                />
              </label>
              <div className="workflow-preview__actions">
                <button
                  type="button"
                  disabled={!currentPlan}
                  onClick={() => currentPlan && setRequestBody(sampleRequest(currentPlan))}
                >
                  {t('Fill sample request')}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!currentPlan}
                  onClick={runMock}
                >
                  {t('Run in Local Mock')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSessionSummary(mockSession.reset())
                    setRunResult(null)
                  }}
                >
                  {t('Reset Mock session')}
                </button>
              </div>
              {!currentPlan ? (
                <p className="workflow-hint" role="status">
                  {displayRunReason(currentReason ?? 'Local Mock is not ready.')}
                </p>
              ) : null}
              {runResult ? (
                <div className="workflow-trace" aria-label={t('Execution Trace')}>
                  <h3>{t('Execution Trace')}</h3>
                  {runResult.status === 'passed' ? (
                    <p role="status">
                      {t('Passed: GET returned the same entity created by POST.')}
                    </p>
                  ) : (
                    <p role="alert">
                      {displayRunReason(runResult.reason ?? 'Local Mock execution failed.')}
                    </p>
                  )}
                  <ol>
                    {runResult.trace.map((event) => (
                      <li key={event.sequence}>
                        <strong>
                          {event.sequence}. {event.stepId}
                        </strong>
                        <span>{event.request}</span>
                        <span>
                          HTTP {event.responseStatus} · {t(event.mutation)} ·{' '}
                          {t('{{count}} entities in memory', { count: event.entityCount })}
                        </span>
                        <span>
                          {t('{{count}} response fields', { count: event.responseFieldCount })}
                        </span>
                        {event.outputId ? <code>id: {event.outputId}</code> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          </div>
          <section className="workflow-card workflow-preview" aria-label={t('Arazzo preview')}>
            <div className="workflow-card__heading">
              <h2>{t('Arazzo preview')}</h2>
              <label>
                {t('Format')}
                <select
                  value={format}
                  onChange={(event) => {
                    request.current += 1
                    setArtifact(null)
                    setBusy(false)
                    setFormat(event.target.value as 'yaml' | 'json')
                  }}
                >
                  <option value="yaml">YAML</option>
                  <option value="json">JSON</option>
                </select>
              </label>
            </div>
            <div className="workflow-preview__actions">
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => void preview()}
              >
                {busy ? t('Validating…') : t('Validate and preview')}
              </button>
              <button
                type="button"
                disabled={!currentArtifact?.contents || errors.length > 0}
                onClick={download}
              >
                {t('Download Arazzo')}
              </button>
            </div>
            {errors.length ? (
              <div role="alert">
                {errors.map((item) => {
                  const translated = localize(item.message)
                  return (
                    <div key={item.code + item.message}>
                      <p>
                        {locale === 'en' || translated !== item.message
                          ? translated
                          : t(
                              'Workflow validation failed ({{code}}). Check the current steps and bindings.',
                              { code: item.code },
                            )}
                      </p>
                      {locale !== 'en' && translated === item.message ? (
                        <details>
                          <summary>{t('Technical details')}</summary>
                          <p>{item.message}</p>
                        </details>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
            {currentArtifact?.contents ? (
              <>
                <p role="status">
                  {t('Valid Arazzo document')} · SHA-256 {currentArtifact.contentHash}
                </p>
                <pre tabIndex={0}>{currentArtifact.contents}</pre>
              </>
            ) : (
              <p className="workflow-hint">
                {t('Validate the current draft to preview the exact file before downloading.')}
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
