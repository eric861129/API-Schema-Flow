# M3-B1 Review Workspace Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining M3-B1 vertical slice by connecting the merged Review Session foundation to a typed Review Workspace Snapshot, the browser-safe Review core, and the M3-A Web shell with Accept, Reject, Undo, and live draft topology preview.

**Architecture:** Add a versioned Review Workspace Snapshot 1.1 containing the declared graph and exact baseline Decision Set; expose pure Review behavior through `@api-schema-flow/review/browser`; project trusted Domain data into the existing Review view models; and keep React as a composition and interaction layer over immutable in-memory intents. Every graph change is recomputed from `declaredGraph + baseline decisions + draft decisions` through Review core.

**Tech Stack:** Node.js 24, pnpm 11.24, TypeScript strict mode, React 19, Vite 8, React Flow, existing Domain/Diagnostics/Flow/Review packages, Vitest 4, Testing Library, Playwright Chromium, axe-core.

**Spec:** `docs/superpowers/specs/2026-09-04-m3b1-review-workspace-integration-design.md`

## Global Constraints

- Base commit is exactly `9ae782a33fa24d9919cf4f5920a1977327cfda6e`, whose post-merge `main` CI completed successfully.
- Preserve `ReadOnlyWorkspaceSnapshot` 1.0; add a distinct Review Workspace Snapshot 1.1.
- Web must not cast an unvalidated JSON object through `as unknown as WorkspaceSnapshot`.
- Web imports Review runtime behavior only from `@api-schema-flow/review/browser`.
- Review core remains the authority for decision resolution, supersession, stale/orphaned/conflict handling, duplicate suppression, and graph materialization.
- Materialization starts from `declaredGraph`, never the already-materialized `acceptedGraph`.
- M3-B1 creates only `accept` and `reject` decisions; `edit` is display-only baseline behavior until M3-B2.
- M3-B1 changes remain memory-only; IndexedDB, auto-save, migration, recovery, and Decision Set import/export are M3-B3.
- Declared edges remain authoritative and unchanged.
- Pending, rejected, stale, orphaned, conflicting, and invalid candidates never enter the draft accepted graph.
- No active Edit, Save, Import, Export, Run, Mock, or cloud control may appear.
- 1366 × 768 is the minimum supported desktop viewport.
- Confidence, blocker, state, and provenance meaning must not rely on color alone.
- Every production behavior follows Red → Green → Refactor.
- Every task ends with an independently reviewable commit and focused verification.
- Existing M0–M3-A tests and the merged M3-B1 foundation tests must remain green.

---

### Task 1: Add Review Workspace Snapshot 1.1

**Files:**
- Create: `packages/domain/src/review-workspace-snapshot.ts`
- Create: `packages/domain/tests/unit/review-workspace-snapshot-contract.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces `REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION`.
- Produces `ReviewWorkspaceContext`.
- Produces `ReviewWorkspaceSnapshot<TDiagnostic>`.
- Produces `isReviewWorkspaceSnapshot(value)`.
- Preserves every existing Snapshot 1.0 export and behavior.

- [ ] **Step 1: Write the failing valid-contract test**

Create a minimal typed Snapshot 1.1 fixture and assert:

```ts
expect(isReviewWorkspaceSnapshot(snapshot)).toBe(true)
expect(snapshot.schemaVersion).toBe('1.1')
expect(snapshot.generatedBy.milestone).toBe('M3-B1')
```

The fixture must include:

```ts
reviewContext: {
  projectFingerprint: 'project:reservation:v1',
  sourceRevision: 'source:reservation:openapi:v1',
},
declaredGraph,
acceptedGraph,
inferenceCandidates: [],
reviewDecisionSet: {
  schemaVersion: '1.0',
  revision: 0,
  decisions: [],
  manualEdges: [],
},
reviewOutcomes: [],
```

- [ ] **Step 2: Write failing invalid-contract cases**

Assert `false` for:

```text
schemaVersion other than 1.1
milestone other than M3-B1
missing reviewContext
empty projectFingerprint
missing declaredGraph
non-operation-topology graph
missing reviewDecisionSet
decisions or manualEdges that are not arrays
missing inferenceCandidates or reviewOutcomes arrays
```

Also assert the existing `isReadOnlyWorkspaceSnapshot` 1.0 tests remain unchanged.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @api-schema-flow/domain test -- review-workspace-snapshot-contract.test.ts
```

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 4: Implement the contract and guard**

Use these exact public shapes:

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

The guard must validate the required top-level fields, graph kind/version/arrays, Decision Set version/arrays, deterministic context strings, and candidate/outcome/diagnostic arrays without mutating the input.

- [ ] **Step 5: Export the new contract**

Add exports from `packages/domain/src/index.ts` without renaming or removing Snapshot 1.0 symbols.

- [ ] **Step 6: Run GREEN and Domain regression**

```bash
pnpm --filter @api-schema-flow/domain test
pnpm --filter @api-schema-flow/domain typecheck
pnpm --filter @api-schema-flow/domain build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/review-workspace-snapshot.ts \
  packages/domain/tests/unit/review-workspace-snapshot-contract.test.ts \
  packages/domain/src/index.ts
git commit -m "feat(domain): add review workspace snapshot contract"
```

---

### Task 2: Regenerate a Domain-valid Reservation Review Fixture

**Files:**
- Modify: `tooling/scripts/generate-web-workspace.mjs`
- Modify: `tooling/scripts/check-web-workspace.mjs`
- Modify: `apps/web/public/fixtures/reservation-workspace.json`
- Create: `packages/review/tests/integration/review-workspace-snapshot.integration.test.ts`
- Modify: `packages/review/package.json` only if the integration test command needs an explicit path

**Interfaces:**
- `buildReservationSnapshot()` returns a structurally valid Snapshot 1.1.
- The serialized `acceptedGraph` and `reviewOutcomes` equal Review core baseline materialization.
- Fixture regeneration remains byte-deterministic.

- [ ] **Step 1: Write a RED baseline-materialization integration test**

Load the committed JSON fixture and assert:

```ts
expect(isReviewWorkspaceSnapshot(snapshot)).toBe(true)

const result = materializeReviewedOperationGraph({
  declaredOperationGraph: snapshot.declaredGraph,
  candidates: snapshot.inferenceCandidates,
  decisionSet: snapshot.reviewDecisionSet,
})

expect(result.graph).toEqual(snapshot.acceptedGraph)
expect(result.outcomes).toEqual(snapshot.reviewOutcomes)
```

Also assert that every candidate has current Domain fields:

```text
schemaVersion
id
fingerprint
ruleSetVersion
sourceOperationNodeId
targetOperationNodeId
sourceOperationKey
targetOperationKey
mapping
score
confidence
band
evidence
blockers
provenance
status
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @api-schema-flow/review test:integration -- \
  review-workspace-snapshot.integration.test.ts
```

Expected: FAIL because the current fixture is Snapshot 1.0 and candidate shapes do not match Domain.

- [ ] **Step 3: Build deterministic declared graph and candidates**

Update the generator to create:

```text
Declared edge:
POST /reservations response reservationId
→ GET /reservations/{id} path id

Baseline accepted inferred candidate:
POST /auth/login response token
→ GET /spaces/available header Authorization

Baseline manual/edit candidate:
GET /spaces/available response array spaceId
→ POST /reservations request body /spaceId

Pending candidate A:
POST /reservations response reservationId
→ GET /reservations/{id} path id
(already-present against the declared mapping)

Pending candidate B:
POST /reservations response status
→ POST /reservations request body /spaceId
(kept pending for Reject/Undo journey)
```

Every mapping must contain current `FlowDataMapping` fields:

```ts
{
  id,
  source,
  target,
  aliases: [],
  sourcePointers,
  transform?,
}
```

Every graph edge review metadata must contain the real `decisionId`, candidate identity fields, rule-set version, and evidence rule IDs.

- [ ] **Step 4: Build exact baseline decisions**

Create deterministic `accept` and `edit` decisions with revisions starting at `1`, then derive IDs using the same canonical identity semantics as Review core. Store them in:

```ts
reviewDecisionSet: {
  schemaVersion: '1.0',
  revision: 1,
  decisions: [...],
  manualEdges: [],
}
```

Do not synthesize IDs as `'decision:' + edge.id`.

- [ ] **Step 5: Materialize the baseline inside the generator check**

The test/check path must independently materialize:

```ts
materializeReviewedOperationGraph({
  declaredOperationGraph,
  candidates,
  decisionSet,
})
```

Then use its graph and outcomes as the expected Snapshot fields or compare generated values before serialization. A mismatch must fail generation.

- [ ] **Step 6: Regenerate and verify deterministic output**

```bash
pnpm check:web-fixture
node tooling/scripts/generate-web-workspace.mjs
pnpm check:web-fixture
```

Expected: the second check reports the committed fixture is current; no absolute paths, representative secrets, or timestamps appear.

- [ ] **Step 7: Run GREEN and regression**

```bash
pnpm --filter @api-schema-flow/review test:integration -- \
  review-workspace-snapshot.integration.test.ts
pnpm check:web-fixture
pnpm test:integration
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tooling/scripts/generate-web-workspace.mjs \
  tooling/scripts/check-web-workspace.mjs \
  apps/web/public/fixtures/reservation-workspace.json \
  packages/review/tests/integration/review-workspace-snapshot.integration.test.ts \
  packages/review/package.json
git commit -m "fix(fixtures): emit materializable review workspace data"
```

---

### Task 3: Expose and Gate the Browser-safe Review API

**Files:**
- Create: `packages/review/src/browser.ts`
- Create: `packages/review/tests/unit/browser-entry.test.ts`
- Create: `packages/review/tests/integration/browser-parity.integration.test.ts`
- Modify: `packages/review/package.json`
- Create: `tooling/scripts/check-review-browser-bundle.mjs`
- Modify: `tooling/scripts/check-boundaries.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `@api-schema-flow/review/browser`.
- Produces root command `pnpm check:review-browser-bundle`.
- Browser/root decision IDs, resolution, and materialization remain identical.

- [ ] **Step 1: Write the browser import RED test**

Import only from the future subpath and exercise:

```ts
createReviewDecisionId
canonicalizeDecisionSet
resolveReviewDecisions
materializeReviewedOperationGraph
```

Expected exports must not include `parseReviewDecisionSet`, because parsing persisted files is not needed by M3-B1 Web integration.

- [ ] **Step 2: Write identity and materialization parity RED tests**

Create the same Accept decision through package-root and browser exports and assert equal IDs. Materialize the Reservation baseline through both entries and assert byte-equivalent graph, outcomes, metrics, and diagnostics.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @api-schema-flow/review test -- browser-entry.test.ts
pnpm --filter @api-schema-flow/review test:integration -- browser-parity.integration.test.ts
```

Expected: FAIL because `@api-schema-flow/review/browser` does not exist.

- [ ] **Step 4: Add the minimal browser entry and package export**

`packages/review/src/browser.ts` must re-export only pure functions and types. Add:

```json
"./browser": {
  "types": "./dist/browser.d.ts",
  "import": "./dist/browser.js",
  "default": "./dist/browser.js"
}
```

Keep the package root backward compatible.

- [ ] **Step 5: Implement the bundle gate**

Bundle or statically traverse `dist/browser.js` and fail if output contains or resolves:

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
fastify
hono
msw
```

The script must exit non-zero with the exact prohibited marker it found.

- [ ] **Step 6: Extend source boundaries**

Allow `apps/web/src/review/**` to import `@api-schema-flow/review/browser`; reject imports from the Review package root and every parser/source/CLI/export/server/mock/execution package.

- [ ] **Step 7: Run GREEN**

```bash
pnpm --filter @api-schema-flow/review test
pnpm --filter @api-schema-flow/review test:integration
pnpm --filter @api-schema-flow/review build
pnpm check:review-browser-bundle
pnpm boundaries:check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/review/src/browser.ts \
  packages/review/tests/unit/browser-entry.test.ts \
  packages/review/tests/integration/browser-parity.integration.test.ts \
  packages/review/package.json tooling/scripts package.json
git commit -m "feat(review): expose browser-safe review semantics"
```

---

### Task 4: Replace the Unsafe Web Snapshot Boundary

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/data/types.ts`
- Modify: `apps/web/src/data/load-workspace.ts`
- Create: `apps/web/src/data/load-workspace.test.ts`
- Modify: `apps/web/src/app.test.tsx`
- Modify: `apps/web/src/workspace/operation-view-model.test.ts`

**Interfaces:**
- `WorkspaceSnapshot` becomes `ReviewWorkspaceSnapshot<DiagnosticValue>` or the equivalent imported Domain type.
- `loadWorkspaceSnapshot()` returns a validated Snapshot 1.1.
- No duplicated Domain graph/candidate/outcome types remain in `apps/web/src/data/types.ts`.

- [ ] **Step 1: Write loader RED tests**

Cover:

```text
valid Snapshot 1.1 returns typed data
network exception maps to network error
non-OK HTTP maps to network error
invalid JSON maps to invalid-json
Snapshot 1.0 maps to unsupported with concrete 1.1 requirement
unknown future version maps to unsupported
missing reviewDecisionSet maps to invalid-shape
invalid declared graph maps to invalid-shape
```

- [ ] **Step 2: Add compile-time type assertions**

In tests, access:

```ts
snapshot.inferenceCandidates[0]?.mapping
snapshot.reviewDecisionSet.decisions
snapshot.reviewOutcomes[0]?.state
snapshot.declaredGraph.edges
```

No cast or `unknown` narrowing should be required after load.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @api-schema-flow/web exec vitest run \
  src/data/load-workspace.test.ts \
  src/app.test.tsx \
  src/workspace/operation-view-model.test.ts
```

Expected: FAIL against the current force-cast loader and Snapshot 1.0 test fixtures.

- [ ] **Step 4: Replace duplicated Domain types**

Keep only Web-specific view types in `data/types.ts`, for example:

```ts
import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { ReviewWorkspaceSnapshot } from '@api-schema-flow/domain'

export type WorkspaceSnapshot = ReviewWorkspaceSnapshot<Diagnostic>
export type SelectedElement =
  | { readonly kind: 'node' | 'edge'; readonly id: string }
  | null
```

Add direct Web dependencies on `@api-schema-flow/diagnostics` and `@api-schema-flow/review` as required by imports.

- [ ] **Step 5: Validate instead of casting**

Call `isReviewWorkspaceSnapshot(value)`. On failure, distinguish unsupported version from invalid shape before returning. Remove:

```ts
return value as unknown as WorkspaceSnapshot
```

- [ ] **Step 6: Update existing Web test fixtures to 1.1**

Use a shared factory under `apps/web/src/test/review-workspace-fixture.ts` if three or more tests need the same complete Snapshot object; otherwise keep focused local fixtures.

- [ ] **Step 7: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test
pnpm --filter @api-schema-flow/web typecheck
pnpm --filter @api-schema-flow/web build
pnpm check:web-bundle
```

Expected: PASS with no Node-only bundle marker.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/src/data apps/web/src/test \
  apps/web/src/app.test.tsx apps/web/src/workspace/operation-view-model.test.ts \
  pnpm-lock.yaml
git commit -m "fix(web): validate typed review workspace snapshots"
```

---

### Task 5: Build Decision Factory, Materialization Engine, and Domain Adapters

**Files:**
- Create: `apps/web/src/review/decision-factory.ts`
- Create: `apps/web/src/review/decision-factory.test.ts`
- Create: `apps/web/src/review/review-engine.ts`
- Create: `apps/web/src/review/review-engine.test.ts`
- Create: `apps/web/src/review/review-workspace-adapter.ts`
- Create: `apps/web/src/review/review-workspace-adapter.test.ts`
- Modify: `apps/web/src/review/review-session.ts`
- Modify: `apps/web/src/review/review-session.test.ts`
- Modify: `apps/web/src/review/review-selectors.ts`
- Modify: `apps/web/src/review/review-selectors.test.ts`

**Interfaces:**
- Produces `deriveBaselineRevisions(snapshot.reviewDecisionSet)`.
- Produces `createReviewDecisionFromIntent(intent, candidate)`.
- Produces `materializeReviewSession(snapshot, session)`.
- Produces `projectReviewWorkspace(snapshot, materialization)`.
- Existing Candidate List, Mapping Preview, and Evidence Inspector consume the resulting foundation view models unchanged.

- [ ] **Step 1: Write decision-factory RED tests**

For an Accept intent, assert the exact Domain decision:

```ts
{
  schemaVersion: '1.0',
  id: createReviewDecisionId(expectedInput),
  candidateId: candidate.id,
  candidateFingerprint: candidate.fingerprint,
  ruleSetVersion: candidate.ruleSetVersion,
  revision: intent.revision,
  action: 'accept',
}
```

For Reject, assert `action: 'reject'`; structured reason/note remain in `ReviewIntent` and are not invented as Domain fields.

- [ ] **Step 2: Write revision RED tests**

Derive maximum baseline revisions per candidate from the exact baseline Decision Set. Assert a candidate with baseline revisions `1` and `3` receives draft revision `4`.

- [ ] **Step 3: Write materialization RED tests**

Cover:

```text
baseline graph equals stored acceptedGraph
Accept adds one inferred accepted edge
Reject after a lower Accept removes that inferred edge
Reject never removes a declared equivalent
Undo returns the previous graph and outcomes
input snapshot and session arrays remain referentially unchanged
```

Assert the engine calls Review core with `snapshot.declaredGraph`.

- [ ] **Step 4: Write adapter RED tests**

Project valid candidates into `ReviewCandidateRow` and `ReviewCandidateDetail`, including:

```text
source and target labels
selector and target descriptor
confidence and band
evidence and blocker counts
rule-set version and fingerprint
type, format, required state, array depth
aliases and template transform summary
source pointers
```

- [ ] **Step 5: Write candidate-state priority RED tests**

Cover conflict diagnostic, invalid, stale, orphaned, applied Accept, applied Edit, Reject, superseded, already-present, and pending. Assert the documented priority order.

- [ ] **Step 6: Run RED**

```bash
pnpm --filter @api-schema-flow/web exec vitest run \
  src/review/decision-factory.test.ts \
  src/review/review-engine.test.ts \
  src/review/review-workspace-adapter.test.ts \
  src/review/review-session.test.ts \
  src/review/review-selectors.test.ts
```

Expected: FAIL because the integration modules do not exist.

- [ ] **Step 7: Implement decision and engine composition**

Use only:

```ts
import {
  canonicalizeDecisionSet,
  createReviewDecisionId,
  materializeReviewedOperationGraph,
} from '@api-schema-flow/review/browser'
```

Build the combined Decision Set as:

```ts
canonicalizeDecisionSet({
  schemaVersion: '1.0',
  revision: Math.max(snapshot.reviewDecisionSet.revision, ...draftRevisions),
  decisions: [...snapshot.reviewDecisionSet.decisions, ...draftDecisions],
  manualEdges: snapshot.reviewDecisionSet.manualEdges,
})
```

- [ ] **Step 8: Implement deterministic schema resolution**

Resolve body pointers through object properties and array items. Resolve parameters by normalized location/name. Multiple incompatible response matches produce `unknown`/warning detail rather than choosing by object iteration order.

- [ ] **Step 9: Add 1,000-candidate benchmarks**

Generate deterministic synthetic candidates and assert:

```text
filter/sort < 100 ms
materialization against 500 nodes < 250 ms
```

Use repeated runs and assert the documented budget without printing environment-specific timestamps into committed artifacts.

- [ ] **Step 10: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test
pnpm --filter @api-schema-flow/web typecheck
pnpm boundaries:check
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/review
git commit -m "feat(web): compose review decisions and workspace projections"
```

---

### Task 6: Extract WorkspaceShell and Add Inference Review Navigation

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.test.tsx`
- Create: `apps/web/src/workspace/workspace-shell.tsx`
- Create: `apps/web/src/workspace/workspace-shell.test.tsx`
- Create: `apps/web/src/workspace/workspace-navigation.tsx`
- Create: `apps/web/src/workspace/workspace-navigation.test.tsx`
- Create: `apps/web/src/review/review-session-context.tsx`
- Create: `apps/web/src/review/review-session-context.test.tsx`
- Create: `apps/web/src/review/review-workspace.tsx`
- Create: `apps/web/src/review/review-workspace.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Adds workspace destination union: `'topology' | 'outline' | 'inference-review'`.
- `App` owns loading/error/empty states and renders `WorkspaceShell` for ready state.
- `ReviewSessionProvider` owns reducer state and memoized materialization.
- `ReviewWorkspace` receives projected rows/details/result and dispatch callbacks through context.

- [ ] **Step 1: Write extraction RED test**

Assert loading, error, retry, and no-operation states remain owned by `App`; a valid snapshot renders `WorkspaceShell`.

- [ ] **Step 2: Write navigation RED test**

Assert Topology, Outline, and Inference Review are real destinations. Diagnostics remains a drawer action; About remains informational. No future Workflows, Mock, Run, Save, Import, or Export destination is rendered.

- [ ] **Step 3: Write Review context RED test**

Assert initial state uses snapshot review context and baseline revisions, and that dispatching Accept/Reject/Undo recomputes one immutable materialization result.

- [ ] **Step 4: Write shell behavior RED test**

Switching into Review hides the Operations and existing Inspector panels but preserves their query/selection/open state. Returning to Topology restores the previous M3-A surface.

- [ ] **Step 5: Run RED**

```bash
pnpm --filter @api-schema-flow/web exec vitest run \
  src/app.test.tsx \
  src/workspace/workspace-shell.test.tsx \
  src/workspace/workspace-navigation.test.tsx \
  src/review/review-session-context.test.tsx \
  src/review/review-workspace.test.tsx
```

Expected: FAIL because the new composition modules do not exist.

- [ ] **Step 6: Extract without changing M3-A behavior**

Move the ready-state composition from `app.tsx` into `WorkspaceShell`. Preserve dynamic ELK import, Topology filtering, Outline, Diagnostics, selection, operations collapse, inspector collapse, and layout-direction controls.

- [ ] **Step 7: Add provider and Review destination**

Initialize once per loaded snapshot:

```ts
createInitialReviewSession({
  projectFingerprint: snapshot.reviewContext.projectFingerprint,
  sourceRevision: snapshot.reviewContext.sourceRevision,
  baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
})
```

Expose IDs, primitive filter state, immutable intents, projection, materialization, and dispatch; do not copy full candidate objects into React state.

- [ ] **Step 8: Add responsive Review layout skeleton**

Create semantic regions for Candidate List, Mapping/Topology preview, Evidence Inspector, actions, Review Summary, and status bar. The skeleton must render concrete empty/no-selection states before actions are connected.

- [ ] **Step 9: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test
pnpm --filter @api-schema-flow/web typecheck
pnpm --filter @api-schema-flow/web build
pnpm check:web-bundle
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app.tsx apps/web/src/app.test.tsx \
  apps/web/src/workspace apps/web/src/review apps/web/src/styles.css
git commit -m "refactor(web): add review-ready workspace composition"
```

---

### Task 7: Connect Candidate Discovery, Preview, and Evidence

**Files:**
- Create: `apps/web/src/review/review-filters.tsx`
- Create: `apps/web/src/review/review-filters.test.tsx`
- Create: `apps/web/src/review/review-summary-table.tsx`
- Create: `apps/web/src/review/review-summary-table.test.tsx`
- Modify: `apps/web/src/review/candidate-list.tsx`
- Modify: `apps/web/src/review/candidate-list.test.tsx`
- Modify: `apps/web/src/review/mapping-preview.tsx`
- Modify: `apps/web/src/review/mapping-preview.test.tsx`
- Modify: `apps/web/src/review/evidence-inspector.tsx`
- Modify: `apps/web/src/review/evidence-inspector.test.tsx`
- Modify: `apps/web/src/review/review-workspace.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Filters dispatch existing session actions.
- Candidate List consumes adapter rows and emits candidate IDs.
- Mapping Preview and Evidence Inspector consume the selected adapter detail.
- Review Summary provides a semantic non-spatial alternative.

- [ ] **Step 1: Write filter RED tests**

Cover query, High/Medium/Low/Hidden toggles, Pending/Accepted/Rejected/Edited/Needs attention/All state selection, blockers-only, sort selection, visible count, and a concrete filter-empty recovery message.

- [ ] **Step 2: Complete keyboard RED tests**

Cover Arrow Up/Down, Home/End, Enter/Space selection, `/` search focus outside inputs, Escape clearing search, and focus retention when the selected row changes state.

- [ ] **Step 3: Write real Domain detail RED tests**

Render the valid Reservation adapter output and assert source/target operation, selector, target descriptor, type/format/required state, array depth, rule IDs, weights, blockers, source pointers, rule-set version, candidate ID, fingerprint, and non-authoritative notice.

- [ ] **Step 4: Write Review Summary RED test**

Assert the table exposes source, target, confidence, state, evidence count, blocker count, and selected row using headers and accessible names.

- [ ] **Step 5: Run RED**

```bash
pnpm --filter @api-schema-flow/web exec vitest run \
  src/review/review-filters.test.tsx \
  src/review/candidate-list.test.tsx \
  src/review/mapping-preview.test.tsx \
  src/review/evidence-inspector.test.tsx \
  src/review/review-summary-table.test.tsx \
  src/review/review-workspace.test.tsx
```

Expected: FAIL until the foundation components consume real projected data.

- [ ] **Step 6: Implement filters and global keyboard behavior**

Do not add single-letter Accept/Reject shortcuts. Escape order is dialog/drawer, search, then selection. Search focus must not steal input from another text field.

- [ ] **Step 7: Connect existing foundation components**

Keep Candidate List, Mapping Preview, and Evidence Inspector focused on rendering; data interpretation remains in the adapter. Show concrete invalid/missing/ambiguous descriptions rather than throwing.

- [ ] **Step 8: Implement responsive evidence behavior**

At constrained width, render Evidence as an overlay drawer with close action and correct focus return. At wide width, keep it as a non-overlapping side region.

- [ ] **Step 9: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test
pnpm --filter @api-schema-flow/web build
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/review apps/web/src/styles.css
git commit -m "feat(web): connect candidate review discovery and evidence"
```

---

### Task 8: Implement Accept, Structured Reject, Undo, and Draft Graph Preview

**Files:**
- Create: `apps/web/src/review/review-actions.tsx`
- Create: `apps/web/src/review/review-actions.test.tsx`
- Create: `apps/web/src/review/reject-dialog.tsx`
- Create: `apps/web/src/review/reject-dialog.test.tsx`
- Create: `apps/web/src/review/review-status-bar.tsx`
- Create: `apps/web/src/review/review-status-bar.test.tsx`
- Create: `apps/web/src/review/draft-graph-preview.tsx`
- Create: `apps/web/src/review/draft-graph-preview.test.tsx`
- Modify: `apps/web/src/review/review-workspace.tsx`
- Modify: `apps/web/src/review/review-session.ts`
- Modify: `apps/web/src/review/review-session.test.ts`
- Modify: `apps/web/src/graph/flow-canvas.tsx`
- Modify: `apps/web/src/graph/flow-canvas.test.tsx` if a new accessible label/graph prop requires coverage
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Accept dispatches `accept-candidate`.
- Reject dispatches `reject-candidate` only after dialog validation.
- Undo dispatches `undo-last-draft`.
- Draft graph preview renders the current `MaterializeReviewedGraphResult.graph` through the existing Flow canvas.

- [ ] **Step 1: Write Accept RED journey**

From a pending candidate:

```text
select candidate
activate Accept
append one immutable higher revision
row becomes Accepted
one inferred accepted edge appears
one polite live announcement occurs
selection advances to next visible pending candidate
```

- [ ] **Step 2: Write invalid Accept RED cases**

Conflict, stale, orphaned, invalid, missing-node, and blocked candidate outcomes create no untrusted edge and display the specific outcome/diagnostic.

- [ ] **Step 3: Write Reject dialog RED tests**

Assert exactly six reasons:

```text
Wrong resource
Wrong field
Not a workflow
Duplicate
Unsafe or ambiguous
Other
```

Reason is required; Other requires a trimmed note. Dialog has an accessible name, traps focus, closes on Escape, and returns focus to Reject on cancel.

- [ ] **Step 4: Write Reject supersession RED journey**

Assert:

```text
Accept revision 1 adds inferred edge
Reject revision 2 removes that inferred edge
an equivalent declared edge remains
candidate state becomes Rejected
structured reason remains in memory-only intent
```

- [ ] **Step 5: Write Undo RED journeys**

Cover:

```text
Accept → Undo → Pending
Accept → Reject → Undo → Accepted
second Undo → baseline state
Undo disabled when no draft intent exists
selection restored when still visible
```

- [ ] **Step 6: Write Draft topology RED tests**

Assert label `Draft review preview — not saved`, graph counts by provenance, pending candidate count, Mapping/Topology switch, and no mutation of the baseline accepted graph.

- [ ] **Step 7: Run RED**

```bash
pnpm --filter @api-schema-flow/web exec vitest run \
  src/review/review-actions.test.tsx \
  src/review/reject-dialog.test.tsx \
  src/review/review-status-bar.test.tsx \
  src/review/draft-graph-preview.test.tsx \
  src/review/review-workspace.test.tsx \
  src/review/review-engine.test.ts
```

Expected: FAIL because actions and draft preview are not connected.

- [ ] **Step 8: Implement actions and selection advancement**

After a completed Accept or Reject, select the next visible Pending row; otherwise keep the reviewed row selected. Announce only completed actions and blocking failures.

- [ ] **Step 9: Implement accessible Reject dialog**

Use native `<dialog>` only if JSDOM and browser behavior are wrapped and tested consistently; otherwise implement an ARIA dialog with explicit focus trap, initial focus, Escape handling, inert/background prevention, and focus restoration without adding a UI dependency.

- [ ] **Step 10: Reuse FlowCanvas safely**

Allow `FlowCanvas` to receive an explicit graph/snapshot projection and accessible label so Topology keeps `Accepted API topology` while Review uses `Draft review preview — not saved`. Preserve non-editable nodes/edges and provenance patterns.

- [ ] **Step 11: Implement dirty status**

Display:

```text
No draft changes
1 unsaved review change
N unsaved review changes
Refreshing this page discards the current review changes.
```

- [ ] **Step 12: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test
pnpm --filter @api-schema-flow/web typecheck
pnpm --filter @api-schema-flow/web build
pnpm check:web-bundle
pnpm boundaries:check
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/review apps/web/src/graph apps/web/src/styles.css
git commit -m "feat(web): review candidates with live draft topology"
```

---

### Task 9: Add E2E, Responsive, Accessibility, Visual, and Performance Gates

**Files:**
- Create: `apps/web/e2e/review-workspace.spec.ts`
- Create: `apps/web/e2e/review-keyboard.spec.ts`
- Create: `apps/web/e2e/review-accessibility.spec.ts`
- Create: `apps/web/e2e/review-responsive.spec.ts`
- Create: `apps/web/e2e/review-visual.spec.ts`
- Create: `apps/web/e2e/__screenshots__/review-candidate-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/review-evidence-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/review-reject-1366x768.png`
- Create: `apps/web/e2e/__screenshots__/review-topology-preview-1366x768.png`
- Modify: `apps/web/e2e/workspace.spec.ts`
- Modify: `apps/web/e2e/accessibility.spec.ts`
- Modify: `apps/web/playwright.config.ts` only if deterministic projects/viewports need named entries
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/m3b1-ci.yml`
- Modify: `tooling/scripts/check-web-bundle.mjs`

**Interfaces:**
- Adds canonical pointer and keyboard Review journeys.
- Fails CI on serious/critical axe violations, overlap/clipping regressions, prohibited bundle markers, performance budget failures, or screenshot changes.

- [ ] **Step 1: Write the pointer E2E journey**

```text
Open Reservation workspace
→ enter Inference Review
→ select a pending high-confidence candidate
→ inspect Evidence
→ Accept
→ switch to Draft topology
→ verify inferred accepted edge and unsaved label
→ select another pending candidate
→ Reject with Wrong field
→ verify no candidate edge
→ Undo
→ verify Pending restoration
```

- [ ] **Step 2: Write the keyboard-only E2E journey**

Complete the same review flow without pointer input, including icon rail, `/` search focus, Arrow/Home/End, Enter/Space selection, Evidence toggle, Accept, Reject dialog, Undo, and preview switch.

- [ ] **Step 3: Add responsive geometry assertions**

At 1440 × 900 and 1366 × 768, assert Candidate List, Mapping Preview, Evidence region/drawer, actions, and status bar bounding boxes do not overlap or clip required controls.

- [ ] **Step 4: Add axe gates**

Run axe on:

```text
Review candidate selected
Evidence open
Reject dialog open
Draft topology preview
Review Summary table
```

Fail on serious or critical violations.

- [ ] **Step 5: Add stable visual snapshots**

Disable transitions/animations, use the deterministic fixture, fix viewport/device scale, and capture the four named screenshots. Review images for truncated labels, overlap, invisible focus, or color-only state.

- [ ] **Step 6: Add browser performance gate**

Exercise the synthetic 1,000-candidate/500-node fixture and record only pass/fail budget evidence:

```text
filter/sort < 100 ms
materialization < 250 ms
```

- [ ] **Step 7: Extend CI paths and commands**

The M3-B1 workflow must trigger for:

```text
apps/web/src/review/**
apps/web/src/data/**
apps/web/src/workspace/**
apps/web/src/graph/**
apps/web/e2e/**
packages/domain/**
packages/review/**
tooling/scripts/check-review-browser-bundle.mjs
tooling/scripts/generate-web-workspace.mjs
this spec and plan
```

Run frozen install, Domain/Review/Web tests, fixture check, browser Review bundle check, Web build/bundle scan, Playwright Review journeys, and boundaries.

- [ ] **Step 8: Run the complete browser gate**

```bash
pnpm install --frozen-lockfile
pnpm check:web-fixture
pnpm check:review-browser-bundle
pnpm build:web
pnpm check:web-bundle
pnpm test:web
pnpm exec playwright install chromium
pnpm test:web:e2e
pnpm boundaries:check
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/e2e apps/web/playwright.config.ts \
  .github/workflows tooling/scripts/check-web-bundle.mjs
git commit -m "test(web): verify M3-B1 review workspace journey"
```

---

### Task 10: Document and Verify the Exact Merge Candidate

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`
- Modify: `docs/00-DOCUMENT-INDEX.md`
- Create: `docs/reports/m3b1-review-workspace-integration-verification.md`
- Create: `docs/design/implemented/m3b1/README.md`
- Create: `docs/design/implemented/m3b1/review-candidate.png`
- Create: `docs/design/implemented/m3b1/review-evidence.png`
- Create: `docs/design/implemented/m3b1/review-reject.png`
- Create: `docs/design/implemented/m3b1/review-topology-preview.png`

**Interfaces:**
- Documents completed M3-B1 behavior without claiming M3-B2/M3-B3 functionality.
- Records exact-head evidence required before leaving Draft.

- [ ] **Step 1: Document the user journey**

Explain how to enter Inference Review, filter/select candidates, read mapping/evidence, Accept, Reject, switch to Draft topology, and Undo. State prominently that refresh discards all current draft changes.

- [ ] **Step 2: Update roadmap boundaries**

Mark Review Workspace Accept/Reject/Undo/Draft Preview complete. Keep these future:

```text
M3-B2 Edit Mapping
M3-B3 IndexedDB, auto-save, migration, recovery, Decision Set import/export
M3-C Workflow Builder and Arazzo editing
M4 Stateful Mock, execution, and Live Trace
```

- [ ] **Step 3: Publish approved screenshots**

Copy only reviewed canonical Playwright images to `docs/design/implemented/m3b1/` and describe viewport, state, and accessibility behavior in its README.

- [ ] **Step 4: Create the verification report**

Record:

```text
base SHA
exact branch SHA
Node/pnpm versions
Snapshot schema versions
fixture parity result
unit/integration/E2E test counts
performance budgets and observed results
bundle sizes and prohibited-marker scan
axe result
viewport result
screenshot paths
commands and exit codes
known non-blocking warnings
```

- [ ] **Step 5: Audit exclusions**

Search rendered UI and source for active controls named or behaving as Edit, Save, Import, Export, Run, Mock, persistence, or cloud collaboration. Documentation references are allowed; interactive controls are not.

- [ ] **Step 6: Run full repository verification**

```bash
pnpm install --frozen-lockfile
pnpm workspace:check
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:flow-fixtures
pnpm test:inference-benchmark
pnpm test:inference-performance
pnpm test:review
pnpm test:export-arazzo
pnpm test:review-export-fixtures
pnpm check:web-fixture
pnpm check:review-browser-bundle
pnpm build:web
pnpm check:web-bundle
pnpm test:web
pnpm test:web:e2e
pnpm boundaries:check
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 7: Push exact head and update Draft PR evidence**

Record the remote SHA and successful exact-head GitHub Actions URLs in the PR body. Any later commit invalidates the evidence and requires a fresh run.

- [ ] **Step 8: Commit**

```bash
git add README.md README.zh-TW.md CHANGELOG.md ROADMAP.md \
  docs/00-DOCUMENT-INDEX.md docs/reports docs/design/implemented/m3b1
git commit -m "docs: complete M3-B1 review workspace verification"
```

## Self-review

### Spec coverage

- Snapshot 1.1 and compatibility: Tasks 1–2.
- Domain-valid deterministic fixture and baseline reconstruction: Task 2.
- Browser-safe Review boundary and identity parity: Task 3.
- Typed Web loader boundary: Task 4.
- Intent conversion, Review materialization, state projection, schema resolution, and performance: Task 5.
- M3-A shell preservation and real Review destination: Task 6.
- Candidate discovery, Mapping Preview, Evidence, keyboard behavior, and Review Summary: Task 7.
- Accept, structured Reject, supersession, Undo, dirty status, and live Draft topology: Task 8.
- Pointer, keyboard, responsive, axe, visual, performance, bundle, and CI gates: Task 9.
- User documentation, exclusions, verification report, and exact-head evidence: Task 10.

### Placeholder scan

The plan contains no TBD, unassigned implementation item, or unnamed test. Each task declares concrete files, interfaces, commands, expected outcomes, and a commit boundary.

### Type consistency

- Snapshot contract is `ReviewWorkspaceSnapshot` 1.1 throughout.
- Session stores `ReviewIntent`; factory produces Domain `ReviewDecision`.
- Combined decisions produce `ReviewDecisionSet`.
- Review core returns `MaterializeReviewedGraphResult`.
- Adapter produces existing `ReviewCandidateRow` and `ReviewCandidateDetail`.
- Draft preview consumes the materialized `FlowGraph`.
- Structured Reject reason remains memory-only in M3-B1 and is not added to the current Domain Decision contract.

### Scope confirmation

This plan completes one vertical M3-B1 subsystem: trusted snapshot → human review → authoritative Review core → unsaved draft preview. It does not include mapping editing, persistence, import/export, workflow authoring, execution, mocking, or cloud behavior.
