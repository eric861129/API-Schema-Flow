# M3-B1 Interactive Review Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated browser-based Inference Review workspace where users can understand candidates, Accept or Reject them through the existing Review semantics, undo in-memory draft actions, and immediately preview the resulting accepted graph.

**Architecture:** M3-B1 keeps semantic review rules inside `@api-schema-flow/review`, exposes a browser-safe entry point when needed, and adds a serializable in-memory Review Session reducer in `apps/web`. Candidate list, mapping preview, evidence inspector, review summary, and topology preview are pure projections over the loaded M3-A snapshot and the current immutable draft decisions. Mapping edits and persistence remain outside this slice.

**Tech Stack:** Node.js 24, pnpm 11.24, TypeScript strict mode, React 19, Vite, Tailwind CSS, React Flow, existing Domain/Flow/Review packages, Vitest, Testing Library, Playwright Chromium, axe-core.

**Spec:** `docs/superpowers/specs/2026-09-03-m3b1-review-session-design.md`

## Global Constraints

- M3-A must be present in the branch baseline and its post-merge `main` CI must have succeeded.
- M3-B1 supports only Accept and Reject; Edit Mapping is M3-B2.
- M3-B1 review changes are memory-only; IndexedDB and Decision Set import/export are M3-B3.
- Review semantics must be delegated to `@api-schema-flow/review`, not reimplemented in React components.
- Pending, rejected, stale, orphaned, superseded, conflicting, and invalid candidates must not enter the accepted graph.
- Declared edges remain authoritative and unchanged.
- Web bundles may not contain Node built-ins, parsers, source loaders, CLI, exporters, server, mock, or execution runtimes.
- Candidate, confidence, blocker, and review states may not rely on color alone.
- 1366 × 768 is the minimum accepted desktop viewport.
- Every production behavior follows Red → Green → Refactor.
- Existing M0–M3-A verification remains green on the exact PR head.

---

### Task 1: Confirm the M3-A Baseline and Browser-safe Review Boundary

**Files:**
- Create: `packages/review/src/browser.ts`
- Create: `packages/review/tests/unit/browser-entry.test.ts`
- Create: `packages/review/tests/integration/browser-parity.integration.test.ts`
- Modify: `packages/review/package.json`
- Modify: `packages/review/src/index.ts` only if public exports need separation
- Modify: `tooling/scripts/check-boundaries.mjs`
- Create: `tooling/scripts/check-review-browser-bundle.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` only if a browser-safe identity dependency is required

**Interfaces:**
- Produces `@api-schema-flow/review/browser` with browser-safe `createReviewDecision`, `parseReviewDecisionSetValue`, `resolveReviewDecisions`, and `materializeReviewedOperationGraph` exports or equivalent existing names.
- Produces `pnpm check:review-browser-bundle`.

- [ ] **Step 1: Verify branch baseline before implementation**

Run:

```bash
test -f apps/web/src/workspace/workspace-shell.tsx
test -f apps/web/src/graph/flow-canvas.tsx
test -f apps/web/src/outline/outline-view.tsx
test -f apps/web/public/fixtures/reservation-workspace.json
pnpm install --frozen-lockfile
pnpm ci:verify
pnpm test:web
```

Expected: PASS. Stop if any M3-A artifact is absent or baseline test fails.

- [ ] **Step 2: Write a failing browser-entry boundary test**

The test imports the browser subpath, exercises Accept and Reject creation, resolution, and materialization, and asserts the existing Golden decision IDs and edge semantics.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @api-schema-flow/review test -- browser-entry.test.ts
```

Expected: FAIL because the browser export does not exist or currently imports a Node-only utility.

- [ ] **Step 4: Add the minimal browser entry point**

Expose only pure review functions. If Node-specific identity code is reachable, isolate it behind the Node entry or replace it with a browser-safe implementation while preserving all existing fixture IDs byte-for-byte.

- [ ] **Step 5: Add bundle scan**

Build a tiny browser bundle importing `@api-schema-flow/review/browser`, then reject:

```text
node:crypto
node:fs
node:path
@api-schema-flow/openapi
@api-schema-flow/arazzo
@api-schema-flow/source-loader
@api-schema-flow/cli
@api-schema-flow/exporter-arazzo
fastify
hono
msw
```

- [ ] **Step 6: Run GREEN and parity regression**

```bash
pnpm --filter @api-schema-flow/review test
pnpm --filter @api-schema-flow/review test:integration
pnpm check:review-browser-bundle
pnpm boundaries:check
```

Expected: PASS with unchanged M2-D fixture identities.

- [ ] **Step 7: Commit**

```bash
git add packages/review tooling/scripts package.json pnpm-lock.yaml
git commit -m "feat(review): expose browser-safe review semantics"
```

---

### Task 2: Review Session Domain, Reducer, and Revision Semantics

**Files:**
- Create: `apps/web/src/review/review-session.ts`
- Create: `apps/web/src/review/review-session.test.ts`
- Create: `apps/web/src/review/review-reducer.ts`
- Create: `apps/web/src/review/review-reducer.test.ts`
- Create: `apps/web/src/review/decision-factory.ts`
- Create: `apps/web/src/review/decision-factory.test.ts`
- Create: `apps/web/src/review/review-selectors.ts`
- Create: `apps/web/src/review/review-selectors.test.ts`
- Create: `apps/web/src/review/review-engine.ts`
- Create: `apps/web/src/review/review-engine.test.ts`

**Interfaces:**
- Produces `ReviewSessionState`, `ReviewSessionAction`, `ReviewRejectReason`, `createInitialReviewSession`, `reviewSessionReducer`, `selectCandidateReviewRows`, `createAcceptDecision`, `createRejectDecision`, and `materializeReviewSession`.

- [ ] **Step 1: Write RED tests for initial projection**

Assert that baseline Review outcomes produce deterministic candidate states and that default filters are Pending + High/Medium + confidence descending.

- [ ] **Step 2: Write RED tests for revision allocation**

For a candidate with revisions 1 and 3, the next Accept or Reject must use revision 4. Timestamps must not affect deterministic identity.

- [ ] **Step 3: Write RED tests for reducer actions**

Cover:

```text
select-candidate
accept-candidate
reject-candidate
undo-last-draft
set-query
toggle-confidence
set-review-state
set-sort
toggle-evidence
set-preview-mode
```

Assert snapshot arrays are never mutated.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @api-schema-flow/web test -- review-session.test.ts review-reducer.test.ts decision-factory.test.ts review-selectors.test.ts review-engine.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 5: Implement immutable session and decision factories**

Decision factories call the browser-safe Review API. Reject requires one of the six structured reasons and a non-empty note for `other`.

- [ ] **Step 6: Implement selectors and candidate-state priority**

Priority:

```text
conflict / invalid
→ stale / orphaned
→ accepted / edited / rejected
→ superseded
→ pending
```

Search normalizes source/target path, operation ID, selector, and target descriptor.

- [ ] **Step 7: Implement Review engine composition**

`materializeReviewSession` combines baseline and draft decisions, resolves through Review core, and materializes the accepted graph. It returns outcomes, graph, diagnostics, and summary counts.

- [ ] **Step 8: Add 1,000-candidate performance test**

Filtering/sorting must finish under 100 ms and materialization against a 500-node synthetic graph under 250 ms in the test environment.

- [ ] **Step 9: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- review-session.test.ts review-reducer.test.ts decision-factory.test.ts review-selectors.test.ts review-engine.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/review
git commit -m "feat(web): add in-memory review session semantics"
```

---

### Task 3: Inference Review Navigation and Simplified Workspace Shell

**Files:**
- Modify: `apps/web/src/workspace/workspace-state.ts`
- Modify: `apps/web/src/workspace/workspace-shell.tsx`
- Modify: `apps/web/src/components/icon-rail.tsx`
- Modify: `apps/web/src/components/top-bar.tsx`
- Create: `apps/web/src/review/review-workspace.tsx`
- Create: `apps/web/src/review/review-workspace.test.tsx`
- Create: `apps/web/src/review/review-session-context.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Adds `inference-review` to the real workspace destination union.
- Produces `ReviewSessionProvider` and `ReviewWorkspace`.

- [ ] **Step 1: Write navigation RED test**

Assert Inference Review is visible, keyboard reachable, and switches the primary region without losing the loaded snapshot. Future Workflows, Mock, Runs, or Export destinations remain absent.

- [ ] **Step 2: Write shell RED test**

Review mode must contain Candidate List, Mapping Preview, conditional Evidence Inspector, action region, and Review Summary; it must not render Edit, Save, Import, Export, Run, or Mock controls.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @api-schema-flow/web test -- review-workspace.test.tsx workspace-shell.test.tsx
```

- [ ] **Step 4: Implement session provider and destination**

Keep `App` and `WorkspaceShell` as composition layers. Review context exposes IDs, primitive filter state, dispatcher, and memoized selectors instead of duplicating candidate objects in React state.

- [ ] **Step 5: Implement responsive layout**

At constrained width, the evidence inspector becomes an overlay. Candidate list remains collapsible and mapping preview retains the largest region.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- review-workspace.test.tsx workspace-shell.test.tsx
pnpm build:web
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/workspace apps/web/src/components apps/web/src/review apps/web/src/styles.css
git commit -m "feat(web): add Inference Review workspace mode"
```

---

### Task 4: Candidate List, Filters, Sorting, and Keyboard Navigation

**Files:**
- Create: `apps/web/src/review/candidate-list.tsx`
- Create: `apps/web/src/review/candidate-list.test.tsx`
- Create: `apps/web/src/review/candidate-row.tsx`
- Create: `apps/web/src/review/review-filters.tsx`
- Create: `apps/web/src/review/confidence-badge.tsx`
- Create: `apps/web/src/review/review-state-badge.tsx`
- Modify: `apps/web/src/review/review-workspace.tsx`

**Interfaces:**
- `CandidateList` consumes projected rows and emits `onSelect(candidateId)`.
- Filters dispatch existing reducer actions.

- [ ] **Step 1: Write Candidate List RED tests**

Cover visible count, default pending High/Medium results, search, confidence filters, state filters, blockers toggle, sorting, and filter-empty guidance.

- [ ] **Step 2: Write keyboard RED tests**

Cover Arrow Up/Down, Home/End, Enter selection, `/` search focus, Escape clearing, and focus retention after list changes.

- [ ] **Step 3: Implement rows and redundant state encoding**

Every row shows textual confidence and review state. Blockers include count and icon/text; selected state changes border, background, and `aria-selected`.

- [ ] **Step 4: Implement filters and sort**

Use buttons/checkboxes/select elements with explicit labels. Do not hide lower-confidence results permanently; users can enable them.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- candidate-list.test.tsx review-selectors.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/review
git commit -m "feat(web): add candidate discovery and keyboard review list"
```

---

### Task 5: Mapping Preview and Evidence Inspector

**Files:**
- Create: `apps/web/src/review/mapping-preview.tsx`
- Create: `apps/web/src/review/mapping-preview.test.tsx`
- Create: `apps/web/src/review/evidence-inspector.tsx`
- Create: `apps/web/src/review/evidence-inspector.test.tsx`
- Create: `apps/web/src/review/evidence-view-model.ts`
- Create: `apps/web/src/review/evidence-view-model.test.ts`
- Create: `apps/web/src/review/review-summary-table.tsx`
- Modify: `apps/web/src/review/review-workspace.tsx`

**Interfaces:**
- Produces pure Evidence view models grouped by positive, negative, neutral, and blockers.
- Exposes an accessible non-spatial Review Summary table.

- [ ] **Step 1: Write mapping-preview RED tests**

Assert source/target operation, selectors, types, formats, required state, alias/transform summary, array warning, compatibility labels, and no editable handles.

- [ ] **Step 2: Write evidence RED tests**

Assert band, numeric score, grouped rules, weights, rule IDs, blockers, source pointers, rule-set version, candidate ID, fingerprint disclosure, and candidate-not-authoritative explanation.

- [ ] **Step 3: Implement pure evidence projection**

Sort evidence by kind, absolute weight descending, and stable rule ID. Never expose examples or runtime values.

- [ ] **Step 4: Implement Mapping Preview and Inspector**

Use open layout, headings, definition lists, and dividers rather than nested cards. Evidence panel is conditional and collapsible.

- [ ] **Step 5: Implement Review Summary alternative**

Provide a semantic table of source, target, confidence, state, and evidence count for the visible candidates.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- mapping-preview.test.tsx evidence-inspector.test.tsx evidence-view-model.test.ts review-summary-table.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/review
git commit -m "feat(web): explain inferred mappings and evidence"
```

---

### Task 6: Accept Action and Draft Accepted Graph Preview

**Files:**
- Create: `apps/web/src/review/review-actions.tsx`
- Create: `apps/web/src/review/review-actions.test.tsx`
- Create: `apps/web/src/review/draft-graph-preview.tsx`
- Create: `apps/web/src/review/draft-graph-preview.test.tsx`
- Create: `apps/web/src/review/review-status-bar.tsx`
- Modify: `apps/web/src/review/review-workspace.tsx`
- Reuse: `apps/web/src/graph/flow-canvas.tsx`

**Interfaces:**
- Accept dispatches `accept-candidate` and displays Review core materialization output.
- Draft graph preview consumes a materialized `FlowGraph` and never mutates the snapshot graph.

- [ ] **Step 1: Write Accept RED test**

From a pending candidate, click Accept and assert:

```text
new immutable revision created
row becomes Accepted
accepted edge appears in draft topology
pending candidate layer remains separate
one polite announcement occurs
selection advances to next visible pending candidate
```

- [ ] **Step 2: Write invalid-outcome RED tests**

Conflict, stale, invalid, duplicate, and missing-node outcomes must show a concrete result and create no edge.

- [ ] **Step 3: Implement Accept action**

Disable only when no candidate is selected or Review core reports a blocking state; explain disabled reasons in text.

- [ ] **Step 4: Implement topology preview mode**

Lazy-load the existing canvas/layout path. Label the view `Draft review preview — not saved` and summarize declared, accepted inferred, and manual edge counts.

- [ ] **Step 5: Implement dirty status**

Display no changes / one unsaved change / N unsaved changes and the memory-only refresh warning.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- review-actions.test.tsx draft-graph-preview.test.tsx review-engine.test.ts
pnpm build:web
pnpm check:web-bundle
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/review
git commit -m "feat(web): accept candidates with draft graph preview"
```

---

### Task 7: Reject Dialog, Structured Reasons, and Undo

**Files:**
- Create: `apps/web/src/review/reject-dialog.tsx`
- Create: `apps/web/src/review/reject-dialog.test.tsx`
- Create: `apps/web/src/review/undo-review-change.tsx`
- Create: `apps/web/src/review/undo-review-change.test.tsx`
- Modify: `apps/web/src/review/review-actions.tsx`
- Modify: `apps/web/src/review/review-workspace.tsx`

**Interfaces:**
- Reject dispatches `reject-candidate` only after valid reason confirmation.
- Undo dispatches `undo-last-draft`.

- [ ] **Step 1: Write Reject dialog RED tests**

Assert six reasons, required reason, note required only for Other, source/target summary, cancel focus return, confirm focus behavior, and Escape close.

- [ ] **Step 2: Write Reject materialization RED test**

Rejecting a pending candidate creates no edge. Rejecting a candidate previously accepted by a lower revision removes only that inferred accepted edge and never a declared equivalent.

- [ ] **Step 3: Implement accessible dialog**

Use native dialog semantics or a tested accessible dialog primitive already present. Trap focus, name the dialog, and restore focus.

- [ ] **Step 4: Write Undo RED tests**

Accept → Reject → Undo restores Accepted; a second Undo restores baseline. Undo disabled state is explicit.

- [ ] **Step 5: Implement Undo and selection advancement**

After Reject, select the next visible pending candidate. Undo restores prior selection where possible.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- reject-dialog.test.tsx undo-review-change.test.tsx review-reducer.test.ts review-engine.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/review
git commit -m "feat(web): reject candidates and undo draft reviews"
```

---

### Task 8: Responsive, Accessibility, E2E, and Browser Boundaries

**Files:**
- Create: `apps/web/e2e/review-session.spec.ts`
- Create: `apps/web/e2e/review-accessibility.spec.ts`
- Create: `apps/web/e2e/review-visual.spec.ts`
- Create: `apps/web/e2e/__screenshots__/review-candidate-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/review-evidence-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/review-reject-1366x768.png`
- Create: `apps/web/e2e/__screenshots__/review-topology-preview-1366x768.png`
- Create: `docs/design/implemented/m3b1/README.md`
- Create: `docs/design/implemented/m3b1/review-candidate.png`
- Create: `docs/design/implemented/m3b1/review-evidence.png`
- Create: `docs/design/implemented/m3b1/review-reject.png`
- Create: `docs/design/implemented/m3b1/review-topology-preview.png`
- Modify: `tooling/scripts/check-web-bundle.mjs`
- Modify: `tooling/scripts/check-boundaries.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Adds canonical pointer and keyboard review journeys and serious/critical axe gates.

- [ ] **Step 1: Add source and bundle boundaries**

Allow only the browser Review entry. Reject package-root Review imports if they reach Node-only code and reject every parser/source/CLI/export/server/mock/execution import from Web review modules.

- [ ] **Step 2: Write pointer E2E journey**

```text
Open workspace
→ Inference Review
→ select pending high-confidence candidate
→ inspect evidence
→ Accept
→ topology preview contains accepted inferred edge
→ select another candidate
→ Reject with Wrong field
→ rejected candidate contributes no edge
→ Undo
→ pending state restored
```

- [ ] **Step 3: Write keyboard-only E2E journey**

Use icon rail, candidate list, Evidence, Accept, Reject dialog, Undo, and topology preview without pointer input.

- [ ] **Step 4: Add responsive bounding-box checks**

At 1440 × 900 and 1366 × 768, candidate list, primary preview, evidence overlay, actions, and status bar must not overlap or clip primary actions.

- [ ] **Step 5: Add axe checks**

Fail on serious/critical violations for list, evidence inspector, Reject dialog, topology preview, and summary table.

- [ ] **Step 6: Generate and review stable screenshots**

Disable animation, use fixed seed/snapshot, and capture the four approved states. Copy accepted images to `docs/design/implemented/m3b1/`.

- [ ] **Step 7: Extend exact-head CI**

Run Review browser bundle check, Web tests, Web build/bundle check, Playwright review journeys, and existing M0–M3-A gates.

- [ ] **Step 8: Run complete browser gate**

```bash
pnpm check:review-browser-bundle
pnpm test:web
pnpm build:web
pnpm check:web-bundle
pnpm exec playwright install chromium
pnpm test:web:e2e
pnpm boundaries:check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/e2e docs/design/implemented/m3b1 tooling/scripts .github/workflows
git commit -m "test(web): verify interactive inference review"
```

---

### Task 9: Documentation and Exact-head Verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`
- Modify: `docs/00-DOCUMENT-INDEX.md`
- Create: `docs/reports/m3b1-review-session-verification.md`

**Interfaces:**
- Documents M3-B1 as memory-only and leaves Mapping Editor/persistence for M3-B2/M3-B3.

- [ ] **Step 1: Document the user journey**

Explain how to open Inference Review, inspect evidence, Accept, Reject, preview graph, and Undo. State prominently that refreshing discards M3-B1 draft changes.

- [ ] **Step 2: Update roadmap without overclaiming**

Mark Accept/Reject and draft preview implemented. Leave Edit Mapping, IndexedDB, Decision Set import/export, Workflow Builder, Mock, execution, and Live Trace future.

- [ ] **Step 3: Create verification report**

Record exact branch SHA, M3-A base merge SHA, dependency versions, test counts, candidate/performance benchmarks, bundle sizes, axe results, viewport results, screenshot paths, and all commands with exit codes.

- [ ] **Step 4: Run full repository verification**

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

- [ ] **Step 5: Audit slice exclusions**

Verify there are no active controls for:

```text
Edit Mapping
Save decisions
Import Decision Set
Export Decision Set
Run Workflow
Start Mock
Export Arazzo
```

- [ ] **Step 6: Push exact head and require GitHub Actions success**

Record remote SHA and successful exact-head Actions run in the PR. Any later commit requires a new exact-head run.

- [ ] **Step 7: Commit**

```bash
git add README.md README.zh-TW.md CHANGELOG.md ROADMAP.md docs
git commit -m "docs: complete M3-B1 review session verification"
```

## Self-review

### Spec coverage

- M3-A baseline and browser Review parity: Task 1.
- Serializable memory-only session, immutable decisions, revision, selectors, materialization, and performance: Task 2.
- Dedicated simplified Review workspace: Task 3.
- Candidate discovery and keyboard navigation: Task 4.
- Mapping explanation, evidence, blockers, and accessible summary: Task 5.
- Accept and accepted graph preview: Task 6.
- Structured Reject and Undo: Task 7.
- Responsive, accessibility, E2E, visual, and bundle gates: Task 8.
- Documentation and exact-head evidence: Task 9.

### Type consistency

- Review Session stores candidate IDs and immutable `ReviewDecision` records.
- Review core produces outcomes and the accepted `FlowGraph`.
- Candidate rows are pure projections and never become authoritative edges.
- M3-B1 can display baseline edited outcomes but cannot create edit decisions.

### Scope confirmation

The plan delivers a complete Accept/Reject review vertical slice. Mapping editing, IndexedDB, Decision Set import/export, project-file writes, workflow authoring, execution, mocking, and cloud behavior remain excluded.
