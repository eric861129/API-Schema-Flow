# M2-D Review Decisions and Deterministic Arazzo Export Design

## Status

Approved for implementation by the repository owner on 2026-09-03 through the instruction to merge M2-C and enter M2-D.

## Goal

Turn M2-C inference candidates into explicit, persistent review decisions; materialize only accepted relationships into a deterministic operation graph; and export an explicitly ordered subset of that accepted graph as a valid, deterministic Arazzo 1.1 document.

## Product boundary

M2-D is the first slice where a human decision can change the authoritative graph. It is still headless and local-first. It does not add the Web workspace, database storage, workflow execution, stateful mocking, automatic workflow ordering, arbitrary JSONPath selectors, branch/onFailure authoring, or LLM inference.

The slice consists of two independently testable packages:

1. `@api-schema-flow/review` owns decision validation, supersession, staleness detection, and accepted-graph materialization.
2. `@api-schema-flow/exporter-arazzo` owns explicit workflow-plan validation and canonical Arazzo 1.1 JSON/YAML generation.

`@api-schema-flow/cli` composes the packages through `review` and `export-arazzo` commands.

## Design principles

- A candidate is never accepted automatically.
- Review decisions are immutable records; a higher integer revision supersedes an older record for the same candidate.
- Timestamps are metadata only and never affect identity, ordering, graph output, or exported bytes.
- A decision applies only to the exact candidate fingerprint and rule-set version it reviewed.
- A changed candidate fingerprint is stale and must not be silently migrated.
- A missing candidate is orphaned and must not create an edge.
- `accept` creates an accepted inferred edge.
- `edit` creates an accepted manual edge derived from the candidate.
- `reject` creates no edge and remains visible in the review report.
- Declared edges remain authoritative and are never mutated by review decisions.
- Candidate and rejected edges never enter the accepted graph or Arazzo output.
- Export requires an explicit ordered workflow plan. Data mappings may add `dependsOn`, but the exporter never invents a business sequence from topology alone.
- Export is deterministic, parser-valid, and secret-safe.

## Domain contracts

### Review decision

Add `packages/domain/src/review-decision.ts` with:

```ts
export const REVIEW_DECISION_SCHEMA_VERSION = '1.0' as const

export type ReviewDecisionAction = 'accept' | 'reject' | 'edit'
export type ReviewDecisionOutcomeState =
  | 'applied'
  | 'rejected'
  | 'stale'
  | 'orphaned'
  | 'superseded'
  | 'already-present'
  | 'invalid'

export interface ReviewDecision {
  readonly schemaVersion: typeof REVIEW_DECISION_SCHEMA_VERSION
  readonly id: string
  readonly candidateId: string
  readonly candidateFingerprint: string
  readonly ruleSetVersion: string
  readonly revision: number
  readonly action: ReviewDecisionAction
  readonly editedMapping?: FlowDataMapping
  readonly decidedAt?: string
}

export interface ReviewDecisionSet {
  readonly schemaVersion: typeof REVIEW_DECISION_SCHEMA_VERSION
  readonly revision: number
  readonly decisions: readonly ReviewDecision[]
  readonly manualEdges: readonly FlowEdge[]
}

export interface ReviewDecisionOutcome {
  readonly decisionId: string
  readonly candidateId: string
  readonly state: ReviewDecisionOutcomeState
  readonly edgeId?: string
  readonly reason?: string
}
```

A decision ID is derived from the candidate ID, candidate fingerprint, rule-set version, revision, action, and edited mapping semantics. `decidedAt` is excluded.

### Flow-edge review metadata

Extend `FlowEdge` with optional structural metadata:

```ts
export interface FlowEdgeReviewMetadata {
  readonly decisionId: string
  readonly candidateId?: string
  readonly candidateFingerprint?: string
  readonly ruleSetVersion?: string
  readonly derivedFromCandidateId?: string
  readonly evidenceRuleIds: readonly string[]
}
```

The metadata contains no runtime value, schema example, default, credential, or timestamp.

### Review result

`@api-schema-flow/review` returns:

```ts
export interface MaterializeReviewedGraphResult {
  readonly graph: FlowGraph
  readonly outcomes: readonly ReviewDecisionOutcome[]
  readonly metrics: {
    readonly appliedCount: number
    readonly rejectedCount: number
    readonly staleCount: number
    readonly orphanedCount: number
    readonly supersededCount: number
    readonly alreadyPresentCount: number
  }
  readonly diagnostics: readonly Diagnostic[]
}
```

## Decision validation and supersession

A valid decision must satisfy all of the following:

- schema version is `1.0`;
- candidate ID, fingerprint, rule-set version, and decision ID are non-empty;
- revision is a positive integer;
- `edit` includes an `editedMapping`;
- `accept` and `reject` do not include `editedMapping`;
- the provided decision ID equals the deterministic ID calculated from the semantic fields;
- `decidedAt`, when present, is a valid ISO-8601 timestamp.

For one candidate ID, the highest revision is active. Lower revisions become `superseded`. Two semantically different decisions at the same highest revision are a conflict and neither is applied. Exact duplicate records are deduplicated.

## Staleness and orphaning

The current inference report is indexed by candidate ID.

- Matching candidate ID, fingerprint, and rule-set version: the decision can apply.
- Matching candidate ID with changed fingerprint or rule-set version: `stale` warning; no edge.
- Candidate ID absent from the current report: `orphaned` warning; no edge.

Stale and orphaned decisions remain in the report so a future UI can explain why an earlier choice no longer applies.

## Accepted graph materialization

Input:

```ts
interface MaterializeReviewedGraphInput {
  readonly declaredOperationGraph: FlowGraph
  readonly candidates: readonly InferenceCandidate[]
  readonly decisionSet: ReviewDecisionSet
}
```

Rules:

- The input graph must be `operation-topology`.
- Preserve every valid declared edge and node byte-for-byte.
- `accept` copies the candidate mapping into a `data` edge with `provenance: inferred` and `status: accepted`.
- `edit` uses `editedMapping`, sets `provenance: manual`, `status: accepted`, and records `derivedFromCandidateId`.
- `reject` produces no graph edge.
- `manualEdges` must be `manual + accepted`, reference existing nodes, and contain at least one mapping.
- Duplicate semantic mappings already present in a declared or earlier accepted edge are suppressed as `already-present`.
- Edge, mapping, node, outcome, and diagnostic ordering is deterministic and independent of input ordering.
- The materialized graph contains only accepted edges.

## Review diagnostics

Add stable codes:

- `ASF-REV-1001` — invalid review input;
- `ASF-REV-1002` — invalid decision record;
- `ASF-REV-1003` — stale decision;
- `ASF-REV-1004` — orphaned decision;
- `ASF-REV-1005` — conflicting decision revision;
- `ASF-REV-1006` — invalid manual edge;
- `ASF-REV-1007` — missing graph node;
- `ASF-REV-1008` — decision ID mismatch.

Stale and orphaned records are warnings. Invalid records, conflicts, missing nodes, and malformed manual edges are errors.

## Arazzo export contracts

The exporter accepts normalized OpenAPI sources, an accepted operation graph, and an explicit workflow plan.

```ts
export interface ArazzoWorkflowPlan {
  readonly schemaVersion: '1.0'
  readonly workflowId: string
  readonly summary?: string
  readonly description?: string
  readonly sourceDescriptions: readonly {
    readonly sourceId: string
    readonly name: string
    readonly url: string
  }[]
  readonly steps: readonly {
    readonly stepId: string
    readonly operationNodeId: string
    readonly description?: string
  }[]
}

export interface ExportArazzoInput {
  readonly title: string
  readonly version: string
  readonly format: 'yaml' | 'json'
  readonly workflowPlan: ArazzoWorkflowPlan
  readonly openApiSources: readonly FlowOpenApiSource[]
  readonly acceptedOperationGraph: FlowGraph
}

export interface ArazzoExportArtifact {
  readonly fileName: string
  readonly mediaType: 'application/yaml' | 'application/json'
  readonly contents: string
  readonly contentHash: string
  readonly document?: NormalizedArazzoDocument
  readonly diagnostics: readonly Diagnostic[]
}
```

## Workflow-plan validation

The plan must satisfy:

- schema version is `1.0`;
- workflow ID, source names, source IDs, URLs, and step IDs are non-empty;
- source names and step IDs are unique;
- each step references an endpoint node present in the accepted operation graph;
- each endpoint node binds to exactly one normalized OpenAPI operation;
- each endpoint source ID has a matching source description;
- step order is explicit and preserved;
- a mapping source step must appear before its target step;
- at least one step exists.

The exporter does not reorder steps to repair a forward dependency.

## Mapping projection

For every accepted `data` edge whose source and target operations both appear in the workflow plan:

1. Create or reuse a deterministic source-step output.
2. Add the corresponding target parameter or request-body value using `$steps.<sourceStep>.outputs.<output>`.
3. Add the source step to target `dependsOn`.

Supported source selectors:

- `response-body` → `$response.body<json-pointer>`;
- `response-header` → `$response.header.<name>`;
- `status-code` → `$statusCode`.

Supported targets:

- `path-parameter`, `query-parameter`, `header-parameter`, `cookie-parameter` → Arazzo Parameter Object;
- `request-body` → nested object payload for object-only JSON Pointer segments.

`querystring-parameter`, request-derived selectors, workflow-input selectors, literals, array-index request-body targets, and transforms with more than one embedded expression are blocked in M2-D.

A single-expression template such as `Bearer {$steps.old.outputs.token}` is rewritten structurally as `Bearer {$steps.<newSourceStep>.outputs.<newOutput>}`. The exporter never copies the old step identifier blindly.

## Operation references

- When the OpenAPI operation has `operationId`, emit `operationId` for a single source description.
- With multiple source descriptions, emit `$sourceDescriptions.<name>.<operationId>`.
- Without `operationId`, emit `operationPath: '{$sourceDescriptions.<name>.url}#/paths/<escaped-path>/<method>'`.

## Determinism

Canonical ordering:

- source descriptions by `name`;
- workflow list contains the one requested workflow;
- steps preserve explicit plan order;
- step parameters sort by `in`, then case-insensitive header name or exact non-header name;
- `dependsOn` sorts by plan position;
- outputs sort by output name;
- object request-body properties sort lexicographically.

The content hash is a lowercase SHA-256 digest of the exact output bytes. Two semantically identical, differently ordered inputs must produce byte-identical content and equal hashes.

## Arazzo validation and secret safety

After serialization, the exporter creates a `SourceDocument` and passes it through `processArazzoSource`. Any parser, semantic, source-resolution, or support error makes the artifact invalid.

The final output is scanned for representative credential-shaped keys and values. Literal selectors are unsupported, so runtime secrets cannot enter generated mappings. Source URLs containing user-info credentials are rejected.

## Export diagnostics

Add stable codes:

- `ASF-EXP-1001` — invalid export input;
- `ASF-EXP-1002` — invalid workflow plan;
- `ASF-EXP-1003` — missing or ambiguous operation binding;
- `ASF-EXP-1004` — unsupported mapping selector/target/transform;
- `ASF-EXP-1005` — forward mapping reference;
- `ASF-EXP-1006` — conflicting target assignment;
- `ASF-EXP-1007` — credential or secret safety violation;
- `ASF-EXP-1008` — generated Arazzo failed validation.

## CLI vertical slice

### `review`

```text
schema-flow review <openapi-file-or-url> --decisions <decision-set.json> [--json]
```

The command loads OpenAPI using the existing retrieval policy, builds declared graphs, runs M2-C inference with default deterministic settings, reads the local decision set, materializes the reviewed operation graph, and reports outcomes, metrics, diagnostics, and the graph. Decision files are local only in M2-D.

### `export-arazzo`

```text
schema-flow export-arazzo <openapi-file-or-url> \
  --decisions <decision-set.json> \
  --workflow <workflow-plan.json> \
  [--format yaml|json] \
  [--output <path>] \
  [--force] \
  [--json]
```

The command repeats the deterministic review pipeline and exports the accepted graph. Without `--output`, artifact contents go to stdout. Existing files are never overwritten unless `--force` is present. Human diagnostics go to stderr when artifact bytes are written to stdout.

## Package boundaries

- `domain` owns review contracts and optional edge metadata.
- `review` may depend on `domain`, `diagnostics`, and `flow`.
- `exporter-arazzo` may depend on `arazzo`, `diagnostics`, `domain`, `flow`, `source-loader`, and `yaml`.
- `review` and `exporter-arazzo` must not depend on parser implementations, CLI, React, React Flow, ELK, server frameworks, mock runtime, execution runtime, or network adapters.
- `cli` remains the composition boundary.

## Fixtures and acceptance gates

Add a canonical Reservation fixture set containing:

- OpenAPI source;
- inference candidates generated at test time;
- accept, reject, edit, stale, and superseded decisions;
- one explicit workflow plan;
- reviewed graph Golden JSON;
- generated Arazzo Golden YAML and JSON.

Acceptance requires:

- accepted candidate becomes `inferred + accepted`;
- edited candidate becomes `manual + accepted` with derivation metadata;
- rejected, stale, orphaned, invalid, and superseded decisions create no edge;
- changed candidate fingerprint never reuses an old decision;
- declared mappings are not duplicated;
- candidate/rejected edges never appear in accepted graph or export;
- generated Arazzo passes the project Arazzo processor;
- export is byte-stable across repeated and reordered input runs;
- Golden files contain no representative secret values;
- all existing M0 through M2-C tests remain green;
- full repository CI and CLI smoke tests pass on one exact branch head.
