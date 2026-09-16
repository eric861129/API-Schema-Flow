# M3-B1 Review Workspace Integration Design

## Status

Approved direction from the repository owner on 2026-09-04. This document narrows the remaining M3-B1 work after the Review Session foundation was merged through PR #14.

The implementation branch starts from the verified `main` commit:

```text
9ae782a33fa24d9919cf4f5920a1977327cfda6e
```

The branch is:

```text
feat/m3b1-review-workspace-integration
```

## Goal

Connect the tested M3-B1 Review Session foundation to the existing M3-A Web workspace and the authoritative Review core so a user can inspect inference candidates, Accept or Reject them, undo the latest in-memory change, and immediately preview the resulting accepted graph.

The completed slice must remain memory-only. Mapping edits, persistence, Decision Set import/export, execution, mocking, and cloud collaboration remain outside M3-B1.

## Verified current-state gaps

Repository inspection found four integration gaps that must be fixed before the UI can safely call Review core.

### 1. Web snapshot types hide Domain data

`apps/web/src/data/types.ts` duplicates part of the Domain model and currently declares:

```ts
readonly inferenceCandidates: readonly unknown[]
readonly reviewOutcomes: readonly unknown[]
```

This prevents compile-time validation of candidate, decision, outcome, graph, and mapping semantics.

### 2. The generated fixture is not a valid Domain candidate set

`tooling/scripts/generate-web-workspace.mjs` currently emits candidate fields such as `source`, `target`, evidence `summary`, and target shapes that do not match the current `InferenceCandidate` and `FlowDataMapping` contracts. The loader validates only the outer object and then force-casts it.

The read-only M3-A screen can render this representative data, but Review core cannot safely consume it.

### 3. Accepted graph alone cannot reproduce review semantics

The M3-A snapshot stores an `acceptedGraph` and `reviewOutcomes`, but not the declared graph or the baseline `ReviewDecisionSet` that created the accepted graph.

Passing the already-materialized accepted graph to `materializeReviewedOperationGraph` as if it were the declared graph would make existing inferred edges look authoritative. A later Reject would be unable to remove a previous Accept reliably, and duplicate suppression could produce incorrect outcomes.

### 4. Review package has no explicit browser subpath

`@api-schema-flow/review` currently exposes only the package root. The implementation is pure today, but the Web application needs a documented browser-only contract and a bundle gate that prevents future Node-only imports from crossing the boundary.

## Chosen architecture

```text
Review Workspace Snapshot 1.1
  ├─ API document
  ├─ declared operation graph
  ├─ baseline ReviewDecisionSet
  ├─ baseline accepted graph
  ├─ inference candidates
  ├─ baseline outcomes
  └─ review context
             │
             ▼
Snapshot validator and Review adapters
             │
             ▼
Serializable in-memory Review Session
             │
      Review Intent → ReviewDecision
             │
             ▼
@api-schema-flow/review/browser
  ├─ deterministic decision identity
  ├─ decision resolution
  └─ accepted graph materialization
             │
        ┌────┴────┐
        ▼         ▼
Review UI     Draft topology preview
```

The architecture keeps three responsibilities separate:

1. **Domain and fixture contract** defines trusted input.
2. **Review core** owns decision resolution and graph materialization.
3. **Web adapters and components** own presentation, interaction, focus, and memory-only session state.

React components must not reproduce decision conflict, stale, orphaned, supersession, duplicate, or graph materialization rules.

## Review Workspace Snapshot 1.1

M3-A Snapshot 1.0 remains available for compatibility. M3-B1 adds a distinct contract rather than silently changing the meaning of version 1.0.

```ts
export const REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION = '1.1' as const

export interface ReviewWorkspaceContext {
  readonly projectFingerprint: string
  readonly sourceRevision: string
}

export interface ReviewWorkspaceSnapshot<TDiagnostic = unknown> {
  readonly schemaVersion: typeof REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION
  readonly generatedBy: {
    readonly package: 'api-schema-flow'
    readonly milestone: 'M3-B1'
  }
  readonly project: ReadOnlyWorkspaceProject
  readonly reviewContext: ReviewWorkspaceContext
  readonly apiDocument: NormalizedApiDocument
  readonly declaredGraph: FlowGraph
  readonly acceptedGraph: FlowGraph
  readonly inferenceCandidates: readonly InferenceCandidate[]
  readonly reviewDecisionSet: ReviewDecisionSet
  readonly reviewOutcomes: readonly ReviewDecisionOutcome[]
  readonly diagnostics: readonly TDiagnostic[]
}
```

### Contract invariants

- `declaredGraph.kind` and `acceptedGraph.kind` are `operation-topology`.
- Both graphs contain the same node IDs.
- `declaredGraph` contains accepted declared edges only.
- `reviewDecisionSet` contains the exact baseline decisions and manual edges used for the snapshot.
- `acceptedGraph` equals deterministic Review materialization over `declaredGraph`, `inferenceCandidates`, and `reviewDecisionSet`.
- Candidate source and target node IDs exist in the graph unless the candidate intentionally demonstrates a missing-node diagnostic.
- Candidate mappings use current `FlowValueSelector`, `FlowValueTarget`, alias, transform, and source-pointer contracts.
- `reviewOutcomes` match the baseline materialization result.
- `projectFingerprint` and `sourceRevision` are deterministic and contain no local paths, timestamps, secrets, or environment-specific values.

### Compatibility behavior

- Domain retains `ReadOnlyWorkspaceSnapshot` and `isReadOnlyWorkspaceSnapshot` for M3-A consumers.
- Web M3-B1 loads Snapshot 1.1 for the interactive Review workspace.
- A 1.0 file receives a concrete unsupported-version message rather than an unsafe cast.
- Unknown future versions are rejected without replacing or corrupting an already-loaded workspace.

## Fixture and loader boundary

The Reservation fixture remains deterministic and representative, but it must become a valid Review Workspace Snapshot 1.1.

The generator will construct:

- one declared OpenAPI Link edge;
- one baseline accepted inferred edge backed by an `accept` decision;
- one baseline manual accepted edge backed by an `edit` decision or `manualEdges`, according to existing Review core semantics;
- additional pending candidates that support Accept, Reject, blocker, duplicate, and selection-advancement journeys.

The loader will call `isReviewWorkspaceSnapshot` and reject invalid shapes. It may add targeted semantic checks for fields the structural guard intentionally leaves shallow, but it may not return a value through `as unknown as ReviewWorkspaceSnapshot`.

A generator test will independently call `materializeReviewedOperationGraph` and assert that the resulting graph and outcomes match the serialized baseline snapshot.

## Browser-safe Review boundary

The package adds:

```text
@api-schema-flow/review/browser
```

The browser subpath exports only pure APIs required by Web:

```ts
createReviewDecisionId
canonicalizeDecisionSet
resolveReviewDecisions
materializeReviewedOperationGraph
```

It also exports the associated input and result types.

The subpath may depend on Domain, Diagnostics, Flow, and browser-safe language/runtime features. It may not import:

```text
node:crypto
node:fs
node:path
node:url
@api-schema-flow/openapi
@api-schema-flow/arazzo
@api-schema-flow/source-loader
@api-schema-flow/cli
@api-schema-flow/exporter-arazzo
server, mock, execution, or persistence modules
```

An identity-parity test proves that decisions created through the browser subpath retain the established deterministic IDs. A bundle scan prevents prohibited imports from entering the browser artifact.

## Web type ownership

`apps/web/src/data/types.ts` will stop redefining Domain graph, operation, mapping, candidate, and outcome structures.

It may retain Web-only types such as:

```ts
export type SelectedElement =
  | { readonly kind: 'node' | 'edge'; readonly id: string }
  | null
```

The canonical workspace type becomes:

```ts
export type WorkspaceSnapshot = ReviewWorkspaceSnapshot<Diagnostic>
```

Web receives an explicit dependency on `@api-schema-flow/review` and imports runtime behavior only from `@api-schema-flow/review/browser`.

## Review adapters

A pure adapter layer converts trusted Domain values into the existing foundation view models.

```ts
export interface ReviewWorkspaceProjection {
  readonly rows: readonly ReviewCandidateRow[]
  readonly details: ReadonlyMap<string, ReviewCandidateDetail>
  readonly baselineRevisions: Readonly<Record<string, number>>
}

export function projectReviewWorkspace(
  snapshot: WorkspaceSnapshot,
  result: MaterializeReviewedGraphResult,
): ReviewWorkspaceProjection
```

### Candidate state projection

The adapter resolves one visible state per candidate using this priority:

```text
conflict
→ invalid
→ stale
→ orphaned
→ accepted / edited / rejected
→ superseded
→ pending
```

Rules:

- `REVIEW_DECISION_CONFLICT` diagnostics map to `conflict`.
- An active `accept` decision with `applied` or `already-present` maps to `accepted`.
- An active `edit` decision maps to `edited`.
- An active `reject` decision maps to `rejected`.
- Lower revisions map to `superseded` only when no higher-priority active or diagnostic state exists.
- A candidate with no applicable decision maps to `pending`.
- `already-present` remains visible in detail as declared-duplicate suppression rather than creating a duplicate edge.

### Source and target schema resolution

The adapter resolves source and target descriptors from `NormalizedApiDocument` and `FlowDataMapping`.

- Response body and header selectors inspect successful/default responses deterministically.
- Request body targets resolve JSON pointers against request schemas.
- Path, query, header, cookie, and querystring targets resolve matching operation parameters.
- Multiple incompatible matches produce an explicit ambiguous/unknown descriptor.
- Missing operations or schema locations produce a concrete blocker/detail state; they never crash the workspace.
- Secret examples and runtime values are never exposed.

## Decision factory and Review engine

The existing Review Session reducer continues to store serializable `ReviewIntent` records. A pure factory converts each intent into a Domain `ReviewDecision` using the current candidate fingerprint and rule-set version.

```ts
export function createReviewDecisionFromIntent(
  intent: ReviewIntent,
  candidate: InferenceCandidate,
): ReviewDecision
```

The factory:

- uses the intent revision;
- uses candidate ID, fingerprint, and rule-set version;
- uses `createReviewDecisionId` from the browser subpath;
- does not include current time in deterministic identity;
- creates only `accept` or `reject` decisions in M3-B1;
- keeps the structured Reject reason and optional note in the memory-only `ReviewIntent`; the current Domain Decision Set does not persist that UI explanation.

The engine combines baseline and draft state:

```ts
export interface ReviewSessionMaterialization {
  readonly decisionSet: ReviewDecisionSet
  readonly result: MaterializeReviewedGraphResult
  readonly projection: ReviewWorkspaceProjection
}

export function materializeReviewSession(
  snapshot: WorkspaceSnapshot,
  session: ReviewSessionState,
): ReviewSessionMaterialization
```

It must:

1. preserve baseline decisions and manual edges;
2. append immutable draft decisions;
3. canonicalize the Decision Set;
4. materialize from `declaredGraph`, never `acceptedGraph`;
5. expose diagnostics and outcomes without changing Review semantics;
6. leave the original snapshot arrays and graphs untouched.

## Web composition

`App` remains responsible for load/error/empty states. The ready-state workspace is extracted to a focused composition layer so Review integration does not turn `app.tsx` into a monolith.

```text
App
└─ WorkspaceShell
   ├─ Top bar and dirty status
   ├─ Workspace navigation
   │  ├─ Topology
   │  ├─ Outline
   │  └─ Inference Review
   ├─ Existing Operations/Inspector surface
   ├─ ReviewSessionProvider
   └─ ReviewWorkspace
      ├─ Review filters
      ├─ Candidate List
      ├─ Mapping Preview
      ├─ Evidence Inspector
      ├─ Accept / Reject actions
      ├─ Reject Dialog
      ├─ Review Summary
      ├─ Draft topology preview
      └─ Undo/status bar
```

Topology and Outline retain existing behavior. Operations and the existing Inspector are hidden or replaced only while Inference Review is active; returning to Topology/Outline restores their previous state.

The icon rail renders no future destination before it works.

## Accept behavior

Accepting a selected pending candidate:

1. appends an immutable `accept` intent at the next revision;
2. converts all baseline and draft intents through the decision factory;
3. materializes through Review core;
4. updates the row state to Accepted when valid;
5. shows the accepted inferred edge in Draft topology preview;
6. preserves every declared edge unchanged;
7. announces one completed action through a polite live region;
8. advances selection to the next visible pending candidate when available.

Conflict, stale, orphaned, invalid, duplicate, or missing-node results create no untrusted edge and display a concrete explanation.

## Reject behavior

Reject opens a structured dialog with exactly these reasons:

```text
Wrong resource
Wrong field
Not a workflow
Duplicate
Unsafe or ambiguous
Other
```

A reason is required. `Other` additionally requires a non-empty note.

Confirming Reject:

1. appends an immutable `reject` intent at the next revision;
2. rematerializes from the declared graph and combined Decision Set;
3. removes a lower-revision accepted inferred edge for the same candidate;
4. never removes an equivalent declared edge;
5. updates the row state to Rejected;
6. returns focus correctly after cancel or completion;
7. advances to the next visible pending candidate when available.

## Undo and dirty state

Undo removes only the latest draft intent and recomputes through Review core. It does not mutate baseline decisions and does not provide redo in M3-B1.

The UI displays:

```text
No draft changes
1 unsaved review change
N unsaved review changes
```

It also displays a non-blocking warning that refreshing the browser discards M3-B1 changes.

## Draft topology preview

The existing Flow canvas is reused with the current materialized graph. It is labeled:

```text
Draft review preview — not saved
```

The preview and its accessible summary expose counts for:

- declared accepted edges;
- accepted inferred edges;
- manual accepted edges;
- pending candidates outside the authoritative graph.

Rejected candidates are absent unless an equivalent declared mapping remains. The preview layout is recomputed without mutating the M3-A baseline layout or snapshot.

## Responsive and accessibility behavior

At 1440 × 900 and 1366 × 768:

- Candidate List remains independently scrollable.
- Mapping Preview remains the largest region.
- Evidence Inspector becomes a closeable overlay at constrained width.
- Primary Accept/Reject/Undo controls remain visible and at least 44 × 44 CSS pixels.
- No panel obscures the selected mapping or decision result.

Keyboard support includes:

- icon-rail navigation;
- `/` to focus candidate search outside text input;
- Arrow Up/Down and Home/End list navigation;
- Enter/Space candidate selection;
- Evidence toggle;
- Accept and Reject actions;
- complete Reject dialog operation;
- Undo;
- Mapping/Topology preview switch;
- Escape context handling and correct focus return.

Confidence, blocker, review state, and graph provenance never rely on color alone. Axe must report no serious or critical violations in the canonical Review states.

## Error handling

Concrete, non-destructive states are required for:

- unsupported Snapshot 1.0 or unknown future version;
- invalid candidate or Decision Set shape;
- baseline materialization mismatch;
- candidate referencing a missing operation or node;
- ambiguous schema resolution;
- Review decision conflict, stale, orphaned, invalid, or already-present result;
- graph layout failure;
- empty candidate set;
- filters returning no candidates.

A Review failure must not replace or corrupt the baseline accepted topology.

## Performance

- Filtering and sorting 1,000 projected candidates completes under 100 ms in the benchmark fixture.
- Accept/Reject materialization for 1,000 candidates and a 500-node graph completes under 250 ms in the browser benchmark fixture.
- React state stores IDs, primitives, and immutable intent arrays rather than duplicate Domain candidates.
- Projection and materialization are memoized by snapshot identity and session revision-relevant state.
- Topology layout remains lazy-loaded.

## Verification strategy

### Contract and fixture

- Snapshot 1.0 guard remains green.
- Snapshot 1.1 valid and invalid contract tests.
- Fixture candidates and decisions satisfy current Domain types.
- Baseline Review materialization matches serialized accepted graph and outcomes byte-for-byte.
- Deterministic fixture regeneration remains clean.

### Review browser boundary

- Browser subpath import test.
- Established decision identity parity.
- Resolution/materialization parity with package root.
- Prohibited dependency bundle scan.

### Unit and component tests

- intent-to-decision factory;
- baseline revision derivation;
- outcome and diagnostic state priority;
- candidate/detail/schema adapters;
- Accept, Reject, Undo, dirty state, and selection advancement;
- navigation and absence of deferred controls;
- dialog validation and focus restoration;
- mapping/evidence/summary presentation;
- draft graph counts and declared-edge preservation.

### End-to-end tests

Canonical pointer and keyboard journeys:

```text
Open Reservation workspace
→ enter Inference Review
→ inspect a high-confidence pending candidate
→ Accept
→ verify accepted inferred edge in Draft topology preview
→ select another pending candidate
→ Reject with Wrong field
→ verify no candidate edge
→ Undo
→ verify pending state and graph restoration
```

Run at 1440 × 900 and 1366 × 768 with axe and stable screenshots.

## Explicitly out of scope

- Edit Mapping and schema-tree field selection;
- IndexedDB, LocalStorage, auto-save, reload restoration, migration, and recovery;
- Decision Set file import/export or clipboard export;
- project-file writes;
- Workflow Builder or Arazzo editing/export UI;
- Stateful Mock Runtime;
- workflow execution and Live Trace;
- authentication, cloud storage, telemetry, and collaboration.

## Acceptance criteria

The integration is complete when:

1. the branch is based on verified `main@9ae782a33fa24d9919cf4f5920a1977327cfda6e`;
2. Review Workspace Snapshot 1.1 is typed, validated, deterministic, and materialization-consistent;
3. Web no longer hides candidates and outcomes behind `unknown[]` or an unsafe root cast;
4. `@api-schema-flow/review/browser` passes identity and bundle-boundary gates;
5. Inference Review is a real workspace destination;
6. candidates can be searched, filtered, sorted, and selected by pointer or keyboard;
7. Mapping Preview and Evidence Inspector show trusted Domain data and concrete blocker states;
8. Accept and Reject create immutable higher revisions through Review core;
9. a later Reject removes a lower-revision inferred Accept while declared edges remain unchanged;
10. Draft topology preview updates immediately and is explicitly labeled unsaved;
11. Undo removes the latest draft intent and restores the prior Review result;
12. no Edit, Save, Import, Export, Run, Mock, or cloud control is rendered;
13. pointer, keyboard, responsive, axe, visual, performance, bundle, and all inherited regression gates pass on the exact PR head;
14. post-merge `main` CI passes before M3-B2 begins.
