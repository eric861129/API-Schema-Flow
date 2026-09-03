# M3-A Read-only Web Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-quality, read-only browser workspace that visualizes the deterministic accepted API operation graph, supports endpoint discovery and inspection, and provides an accessible outline alternative.

**Architecture:** A versioned browser-safe snapshot is generated in Node.js from the existing OpenAPI → Flow → Inference → Review pipeline and committed as a static fixture. A framework-neutral `@api-schema-flow/layout` package converts `FlowGraph` into deterministic ELK positions. `apps/web` loads only the static snapshot and browser-safe packages, then presents a simplified V2 React workspace with synchronized list, canvas, outline, and inspector selection.

**Tech Stack:** Node.js 24, pnpm 11.24, TypeScript strict mode, React 19, Vite 8, Tailwind CSS 4, `@xyflow/react` 12, ELK.js, Vitest, Testing Library, Playwright, axe-core, Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-03-m3a-read-only-web-workspace-design.md`

## Global Constraints

- M3-A is read-only: no Accept, Reject, Edit, mapping mutation, workflow editing, source editing, execution, mocking, or persistence.
- The graph canvas is the primary workspace region; the inspector is conditional and the diagnostics drawer is collapsed by default.
- The browser must consume a generated Project Snapshot and must not import Node-only parsing, source-loading, review, export, CLI, mock, or execution packages.
- The canonical Reservation snapshot must be deterministic, secret-safe, free of absolute paths, and generated from existing M2-D fixtures.
- `@api-schema-flow/layout` must remain framework-neutral and may depend only on `@api-schema-flow/domain` and `elkjs` at runtime.
- HTTP method, provenance, severity, selection, and focus must never rely on color alone.
- The complete graph meaning must be available through a keyboard-accessible Outline alternative.
- 1366 × 768 is the minimum accepted desktop viewport.
- Every production behavior follows Red → Green → Refactor.
- Existing M0–M2-D verification remains green on the exact PR head.

---

### Task 1: Web Workspace and Toolchain Foundation

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `turbo.json`
- Modify: `tooling/scripts/check-workspace.mjs`
- Create: `tooling/tsconfig/browser-library.json`
- Create: `tooling/tsconfig/react-app.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/test/setup.ts`

**Interfaces:**
- Produces root scripts `dev:web`, `build:web`, `test:web`, `test:web:e2e`, and `check:web-bundle`.
- Produces a compiling but intentionally minimal `apps/web` entry point.

- [ ] **Step 1: Write the workspace-structure failure first**

Update `tooling/scripts/check-workspace.mjs` so the expected workspace list includes `apps/web` and `packages/layout`, then run:

```bash
pnpm workspace:check
```

Expected: FAIL because the new workspace directories and manifests do not exist.

- [ ] **Step 2: Add workspace globs and package manifests**

Change `pnpm-workspace.yaml` to:

```yaml
packages:
  - apps/*
  - packages/*

catalogMode: strict
```

Create the Web manifest with runtime dependencies for React, React DOM, `@xyflow/react`, and `@api-schema-flow/layout`; development dependencies include Vite, React plugin, Tailwind Vite plugin, Testing Library, jsdom, Playwright, and axe-core.

- [ ] **Step 3: Add browser-specific TypeScript configurations**

`tooling/tsconfig/browser-library.json` extends the base config but replaces Node types and libraries with:

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": [],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

`tooling/tsconfig/react-app.json` additionally enables `jsx: react-jsx`, `noEmit: true`, and Vite client types.

- [ ] **Step 4: Create the minimal Web entry point**

Render one semantic heading and a loading message so the app can build before feature components exist:

```tsx
export function App() {
  return (
    <main>
      <h1>API Schema Flow</h1>
      <p>Loading Reservation workspace…</p>
    </main>
  )
}
```

- [ ] **Step 5: Install and lock exact dependencies**

Run:

```bash
pnpm install
pnpm install --frozen-lockfile
```

Expected: both commands exit `0`; `pnpm-lock.yaml` changes only for the new declared dependencies.

- [ ] **Step 6: Verify the foundation**

Run:

```bash
pnpm workspace:check
pnpm --filter @api-schema-flow/web build
pnpm --filter @api-schema-flow/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tooling/tsconfig tooling/scripts/check-workspace.mjs apps/web
git commit -m "chore(web): establish M3-A workspace foundation"
```

---

### Task 2: Browser-safe Project Snapshot Contract

**Files:**
- Create: `packages/domain/src/workspace-snapshot.ts`
- Create: `packages/domain/tests/unit/workspace-snapshot-contract.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces `READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION`, `ReadOnlyWorkspaceProject`, `ReadOnlyWorkspaceSnapshot`, and `isReadOnlyWorkspaceSnapshot`.
- Consumes existing `NormalizedApiDocument`, `FlowGraph`, `InferenceCandidate`, `ReviewDecisionOutcome`, and `Diagnostic` contracts.

- [ ] **Step 1: Write the failing contract test**

The test constructs a minimal valid snapshot and asserts:

```ts
expect(snapshot.schemaVersion).toBe('1.0')
expect(isReadOnlyWorkspaceSnapshot(snapshot)).toBe(true)
expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
```

It also rejects a snapshot whose schema version is `2.0` or whose graph nodes are missing.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @api-schema-flow/domain test -- workspace-snapshot-contract.test.ts
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement the contract and shallow runtime guard**

The guard validates only the public snapshot envelope and essential arrays; it must not duplicate OpenAPI or graph semantic validation.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @api-schema-flow/domain test -- workspace-snapshot-contract.test.ts
pnpm --filter @api-schema-flow/domain typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): add read-only workspace snapshot contract"
```

---

### Task 3: Deterministic Reservation Snapshot Generator

**Files:**
- Create: `tooling/scripts/generate-web-workspace.mjs`
- Create: `tooling/scripts/check-web-workspace.mjs`
- Create: `tooling/scripts/lib/web-workspace-canonical.mjs`
- Create: `tooling/scripts/lib/web-workspace-safety.mjs`
- Create: `tooling/tests/web-workspace-generator.test.mjs`
- Create: `apps/web/public/fixtures/reservation-workspace.json`
- Modify: `package.json`
- Modify: `.prettierignore`

**Interfaces:**
- Produces `pnpm generate:web-fixture` and `pnpm check:web-fixture`.
- Writes exact canonical JSON to `apps/web/public/fixtures/reservation-workspace.json`.
- Consumes only built public package exports from OpenAPI, Flow, Inference, Review, Diagnostics, Redaction, and Domain.

- [ ] **Step 1: Write failing generator safety tests**

Tests must prove that `assertBrowserSafeWorkspace` rejects:

```text
C:\Users\Eric\specs\openapi.yaml
/home/runner/specs/openapi.yaml
synthetic-jwt-token
synthetic-password
an edge whose node does not exist
```

and accepts stable `fixture://reservation/openapi.yaml` URIs.

- [ ] **Step 2: Run RED**

```bash
node --test tooling/tests/web-workspace-generator.test.mjs
```

Expected: FAIL because the generator modules do not exist.

- [ ] **Step 3: Implement canonical sorting and safety validation**

Canonicalization sorts operations, schemas, graph nodes, graph edges, candidates, outcomes, diagnostics, mappings, and evidence by stable IDs or documented semantic keys. Serialization uses two-space JSON indentation and exactly one trailing newline.

- [ ] **Step 4: Implement the existing-package pipeline**

The generator:

```text
loads fixtures/review/reservation/openapi.yaml
loads fixtures/review/reservation/decision-set.json
processes OpenAPI
builds declared graphs
runs inference
parses decisions
materializes the reviewed graph
rewrites source URI to fixture://reservation/openapi.yaml
constructs the snapshot
validates and serializes it
```

It must not copy source examples or defaults into new fields.

- [ ] **Step 5: Run the generator twice and prove byte stability**

```bash
pnpm build
pnpm generate:web-fixture
sha256sum apps/web/public/fixtures/reservation-workspace.json
cp apps/web/public/fixtures/reservation-workspace.json /tmp/reservation-workspace.json
pnpm generate:web-fixture
cmp /tmp/reservation-workspace.json apps/web/public/fixtures/reservation-workspace.json
```

Expected: `cmp` exits `0`.

- [ ] **Step 6: Add drift detection**

`check-web-workspace.mjs` writes to a temporary directory, compares exact bytes with the committed fixture, and exits non-zero with a concrete regeneration command on mismatch.

- [ ] **Step 7: Verify safety and size**

```bash
pnpm check:web-fixture
node --test tooling/tests/web-workspace-generator.test.mjs
test "$(wc -c < apps/web/public/fixtures/reservation-workspace.json)" -lt 256000
! grep -RniE 'synthetic-jwt-token|synthetic-password|(^|[^A-Za-z]):?/(Users|home|tmp|runner)/' apps/web/public/fixtures/reservation-workspace.json
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tooling package.json .prettierignore apps/web/public/fixtures
git commit -m "feat(web): generate deterministic Reservation workspace snapshot"
```

---

### Task 4: Framework-neutral ELK Layout Package

**Files:**
- Create: `packages/layout/package.json`
- Create: `packages/layout/tsconfig.json`
- Create: `packages/layout/src/contracts.ts`
- Create: `packages/layout/src/canonicalize.ts`
- Create: `packages/layout/src/elk-layout-engine.ts`
- Create: `packages/layout/src/index.ts`
- Create: `packages/layout/tests/unit/elk-layout-engine.test.ts`
- Create: `packages/layout/tests/integration/layout-performance.integration.test.ts`
- Modify: `tooling/scripts/check-boundaries.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `FlowLayoutDirection`, `FlowLayoutOptions`, `PositionedFlowGraph`, `FlowLayoutEngine`, `DEFAULT_FLOW_LAYOUT_OPTIONS`, and `createElkFlowLayoutEngine`.

- [ ] **Step 1: Write failing layout contract tests**

Cover empty graph, one node, a connected DAG, disconnected nodes, a cycle, right/down directions, and input-order determinism.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @api-schema-flow/layout test
```

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Implement canonical ELK input**

Node and edge IDs are sorted before passing to ELK. Fixed node dimensions come from options. ELK options use a layered algorithm and direction derived from `right` or `down`.

- [ ] **Step 4: Implement output normalization**

Return finite graph dimensions, deterministically sorted nodes and edges, and normalized edge sections. Empty sections are represented as an empty array rather than `undefined`.

- [ ] **Step 5: Add 500-node performance test**

Generate a deterministic layered graph and require completion under 5,000 ms on CI-class hardware.

- [ ] **Step 6: Add package boundary rules**

Runtime dependencies for `layout` may contain only:

```text
@api-schema-flow/domain
elkjs
```

Source must reject React, React Flow, Node-only project runtimes, source loading, parser, review, export, CLI, mock, execution, and server imports.

- [ ] **Step 7: Run GREEN**

```bash
pnpm --filter @api-schema-flow/layout test
pnpm --filter @api-schema-flow/layout test:integration
pnpm --filter @api-schema-flow/layout build
pnpm --filter @api-schema-flow/layout typecheck
pnpm boundaries:check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/layout tooling/scripts/check-boundaries.mjs pnpm-lock.yaml
git commit -m "feat(layout): add deterministic ELK graph layout"
```

---

### Task 5: Snapshot Loader and Simplified V2 Workspace Shell

**Files:**
- Create: `apps/web/src/data/load-workspace.ts`
- Create: `apps/web/src/data/snapshot-error.ts`
- Create: `apps/web/src/data/load-workspace.test.ts`
- Create: `apps/web/src/workspace/workspace-state.ts`
- Create: `apps/web/src/workspace/workspace-shell.tsx`
- Create: `apps/web/src/workspace/workspace-shell.test.tsx`
- Create: `apps/web/src/components/icon-rail.tsx`
- Create: `apps/web/src/components/top-bar.tsx`
- Create: `apps/web/src/components/panel-toggle.tsx`
- Create: `apps/web/src/components/workspace-status.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces `loadWorkspaceSnapshot(url, fetcher?)` and the initial `WorkspaceViewState` reducer.
- Produces a semantic shell with Topology, Outline, Diagnostics, and About destinations.

- [ ] **Step 1: Write loader RED tests**

Cover successful load, network failure, invalid JSON, unsupported schema version, and empty graph. Assert concrete error codes/messages rather than generic failure text.

- [ ] **Step 2: Implement loader and runtime envelope validation**

Use `isReadOnlyWorkspaceSnapshot`; never import Node-only project packages.

- [ ] **Step 3: Write shell RED tests**

Assert:

- canvas region exists;
- operations panel starts open;
- inspector is absent without selection;
- diagnostics drawer starts collapsed;
- only real M3-A destinations are rendered;
- no Accept, Reject, Edit, Run, Mock, or Export controls exist.

- [ ] **Step 4: Implement the simplified V2 shell**

Use CSS Grid for the desktop shell and CSS variables for semantic dark-theme tokens. Primary regions must have landmark labels.

- [ ] **Step 5: Implement responsive 1366 × 768 behavior**

At constrained widths, the inspector overlays the canvas rather than shrinking it below the accepted minimum. The icon rail remains visible, and the operations panel remains collapsible.

- [ ] **Step 6: Run tests and build**

```bash
pnpm --filter @api-schema-flow/web test -- load-workspace.test.ts workspace-shell.test.tsx
pnpm --filter @api-schema-flow/web build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src apps/web/vite.config.ts
git commit -m "feat(web): add read-only workspace shell and snapshot loading"
```

---

### Task 6: Operation View Model, Search, Filters, and Keyboard List

**Files:**
- Create: `apps/web/src/workspace/operation-view-model.ts`
- Create: `apps/web/src/workspace/operation-view-model.test.ts`
- Create: `apps/web/src/components/method-badge.tsx`
- Create: `apps/web/src/components/operations-panel.tsx`
- Create: `apps/web/src/components/operations-panel.test.tsx`
- Create: `apps/web/src/components/search-field.tsx`
- Create: `apps/web/src/components/method-filter.tsx`

**Interfaces:**
- Produces `buildOperationViewModels(snapshot)`, `filterOperationViewModels(models, filters)`, and `OperationViewModel`.
- Produces `OperationsPanel` callbacks `onSelectNode(nodeId)` and `onFocusNode(nodeId)`.

- [ ] **Step 1: Write view-model RED tests**

Assert deterministic grouping by first tag, `Untagged` fallback, incoming/outgoing counts, normalized search across path/summary/operation ID, method filtering, and stable sorting.

- [ ] **Step 2: Implement pure view-model functions**

Do not access DOM, React state, or React Flow in the view-model module.

- [ ] **Step 3: Write operations-panel RED tests**

Cover visible count, group headings, search, method toggles, filter-empty guidance, selected state, Arrow Up/Down roving focus, Enter selection, Escape clearing, and accessible panel collapse control.

- [ ] **Step 4: Implement panel components**

Method badges always include text and a non-color marker. Operation paths use a monospace stack; metadata remains secondary.

- [ ] **Step 5: Add 500-operation search benchmark test**

Construct 500 deterministic view models and require combined search/filter work to complete under 100 ms in the test environment.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- operation-view-model.test.ts operations-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/workspace apps/web/src/components
git commit -m "feat(web): add searchable keyboard operations panel"
```

---

### Task 7: Read-only React Flow Canvas and Selection Synchronization

**Files:**
- Create: `apps/web/src/graph/graph-view-model.ts`
- Create: `apps/web/src/graph/graph-view-model.test.ts`
- Create: `apps/web/src/graph/endpoint-node.tsx`
- Create: `apps/web/src/graph/mapping-edge.tsx`
- Create: `apps/web/src/graph/flow-canvas.tsx`
- Create: `apps/web/src/graph/flow-canvas.test.tsx`
- Create: `apps/web/src/graph/provenance-style.ts`
- Modify: `apps/web/src/workspace/workspace-shell.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces `buildReactFlowViewModel(snapshot, positionedGraph)`.
- `FlowCanvas` consumes selected element and emits node/edge selection without mutating graph semantics.

- [ ] **Step 1: Write graph-view-model RED tests**

Assert operation binding, compact mapping labels, declared/inferred/manual provenance styles, accepted-only edges, deterministic node/edge order, and no editable handles.

- [ ] **Step 2: Implement graph view model**

React Flow data is a presentation DTO and must not be written back to `FlowGraph`.

- [ ] **Step 3: Write canvas RED tests**

Mock only the browser geometry APIs React Flow requires. Assert node and edge selection, Fit View control, layout-direction control, selected styling, and absence of connection/deletion controls.

- [ ] **Step 4: Implement custom node and edge renderers**

Node content includes method, path, summary/operation ID, tag, and connection counts. Edge styles combine line pattern, marker, text, and selection width so color is never the only signal.

- [ ] **Step 5: Synchronize selection**

Selecting an operation row selects the canvas node and opens the inspector. Selecting a canvas node/edge updates the operations context and inspector. Closing the inspector preserves selection.

- [ ] **Step 6: Honor reduced motion**

No flow-particle animation is used in M3-A. Any focus transition is disabled under `prefers-reduced-motion`.

- [ ] **Step 7: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- graph-view-model.test.ts flow-canvas.test.tsx
pnpm --filter @api-schema-flow/web build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/graph apps/web/src/workspace apps/web/src/styles.css
git commit -m "feat(web): render accepted graph in a read-only canvas"
```

---

### Task 8: Node Inspector, Edge Inspector, Outline, and Diagnostics

**Files:**
- Create: `apps/web/src/inspector/inspector-panel.tsx`
- Create: `apps/web/src/inspector/node-inspector.tsx`
- Create: `apps/web/src/inspector/edge-inspector.tsx`
- Create: `apps/web/src/inspector/inspector-panel.test.tsx`
- Create: `apps/web/src/inspector/schema-summary.tsx`
- Create: `apps/web/src/outline/outline-view.tsx`
- Create: `apps/web/src/outline/outline-view.test.tsx`
- Create: `apps/web/src/diagnostics/diagnostics-drawer.tsx`
- Create: `apps/web/src/diagnostics/diagnostics-drawer.test.tsx`
- Modify: `apps/web/src/workspace/workspace-shell.tsx`

**Interfaces:**
- Inspector consumes the shared selected-element ID and normalized snapshot.
- Outline emits the same node/edge selection events as the canvas.

- [ ] **Step 1: Write node-inspector RED tests**

Assert Overview, Request, Responses, Connections, security summary, source pointer, bounded schema depth, and related-edge selection.

- [ ] **Step 2: Write edge-inspector RED tests**

Assert source selector, target descriptor, mapping label, provenance, accepted status, review metadata, candidate derivation, evidence rule IDs, and source references. Assert no edit controls.

- [ ] **Step 3: Implement inspector components**

Use headings, definition lists, tables, and buttons rather than nested generic cards. The panel has an accessible close/collapse action.

- [ ] **Step 4: Write Outline RED tests**

Verify the operation table and mapping table contain the same nodes and accepted edges as the canvas view model and that selection opens the same inspector.

- [ ] **Step 5: Implement Outline view**

Use semantic tables with captions and expandable connection detail. Preserve search and method filters across Topology/Outline navigation.

- [ ] **Step 6: Write diagnostics RED tests**

Assert collapsed summary, expanded severity/code/message/source rows, deterministic ordering, empty state, and keyboard toggle.

- [ ] **Step 7: Implement diagnostics drawer**

Do not use `aria-live` for every interaction; announce only load/error transitions elsewhere.

- [ ] **Step 8: Run GREEN**

```bash
pnpm --filter @api-schema-flow/web test -- inspector-panel.test.tsx outline-view.test.tsx diagnostics-drawer.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/inspector apps/web/src/outline apps/web/src/diagnostics apps/web/src/workspace
git commit -m "feat(web): add inspectors and accessible graph outline"
```

---

### Task 9: Browser Boundary, Accessibility, E2E, and Visual Evidence

**Files:**
- Create: `tooling/scripts/check-web-bundle.mjs`
- Create: `apps/web/e2e/workspace.spec.ts`
- Create: `apps/web/e2e/accessibility.spec.ts`
- Create: `apps/web/e2e/visual.spec.ts`
- Create: `apps/web/e2e/__screenshots__/topology-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/node-inspector-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/edge-inspector-1440x900.png`
- Create: `apps/web/e2e/__screenshots__/outline-1366x768.png`
- Create: `docs/design/implemented/m3a/README.md`
- Create: `docs/design/implemented/m3a/topology.png`
- Create: `docs/design/implemented/m3a/node-inspector.png`
- Create: `docs/design/implemented/m3a/edge-inspector.png`
- Create: `docs/design/implemented/m3a/outline.png`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `tooling/scripts/check-boundaries.mjs`

**Interfaces:**
- Produces bundle scan and complete canonical browser journey.

- [ ] **Step 1: Write the bundle-boundary check and prove it catches a violation**

Temporarily place a prohibited marker in a test build asset and verify:

```bash
node tooling/scripts/check-web-bundle.mjs apps/web/dist
```

fails for Node built-ins and prohibited workspace package identifiers. Remove the injected marker before continuing.

- [ ] **Step 2: Add Web source boundary rules**

`apps/web/src` rejects Node built-ins and imports from OpenAPI, Arazzo, Source Loader, Inference, Review, Exporter, CLI, mock, execution, and server packages. The Web app may use Domain types and Layout only.

- [ ] **Step 3: Write the canonical Playwright journey**

Test:

```text
load fixture
search reservations
select POST /reservations
verify node inspector
select reservation mapping edge
verify provenance and mapping
switch to Outline
verify equivalent relation
collapse/reopen panels with keyboard
```

Run at both required viewports and assert no primary-region overlap through bounding boxes.

- [ ] **Step 4: Add automated accessibility checks**

Use axe-core after the ready state, node inspector, edge inspector, and Outline view. Fail on serious or critical violations. Include a keyboard-only journey.

- [ ] **Step 5: Add stable visual screenshots**

Disable animations and fix viewport/device scale. Generate and review the four screenshots, then copy the approved images to `docs/design/implemented/m3a/` with an explanatory README.

- [ ] **Step 6: Extend CI**

CI runs:

```text
pnpm check:web-fixture
pnpm build:web
pnpm check:web-bundle
pnpm test:web
pnpm exec playwright install --with-deps chromium
pnpm test:web:e2e
```

Existing `pnpm ci:verify` remains mandatory.

- [ ] **Step 7: Run the complete Web gate**

```bash
pnpm check:web-fixture
pnpm build:web
pnpm check:web-bundle
pnpm test:web
pnpm exec playwright install chromium
pnpm test:web:e2e
```

Expected: PASS with no serious/critical axe violations and accepted screenshots.

- [ ] **Step 8: Commit**

```bash
git add tooling/scripts package.json .github/workflows apps/web/e2e docs/design/implemented/m3a
git commit -m "test(web): add browser, accessibility, and visual gates"
```

---

### Task 10: Documentation and Exact-head Verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`
- Modify: `docs/00-DOCUMENT-INDEX.md`
- Create: `docs/reports/m3a-read-only-web-workspace-verification.md`

**Interfaces:**
- Documents the first Web workspace without claiming M3-B/M4 functionality.

- [ ] **Step 1: Document the implemented user journey**

README sections include:

```bash
pnpm install
pnpm generate:web-fixture
pnpm dev:web
```

and clearly label the workspace read-only.

- [ ] **Step 2: Update roadmap and changelog**

Mark M3-A capabilities as implemented while leaving interactive review, Workflow Builder, Mock Runtime, execution, and Live Trace as future work.

- [ ] **Step 3: Create the verification report**

Record:

- exact branch SHA;
- dependency versions;
- snapshot SHA-256 and size;
- Web bundle sizes;
- unit/component/E2E counts;
- layout benchmark result;
- axe result;
- viewport results;
- screenshot paths;
- all executed commands and exit codes;
- GitHub Actions run URL after the final push.

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
pnpm benchmark:inference
pnpm test:review
pnpm test:export-arazzo
pnpm test:review-export-fixtures
pnpm check:web-fixture
pnpm build:web
pnpm check:web-bundle
pnpm test:web
pnpm test:web:e2e
pnpm boundaries:check
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 5: Review final scope**

Search the Web app and confirm none of these user actions exist:

```text
Accept
Reject
Edit Mapping
Run Workflow
Start Mock
Save Decision
Export Arazzo
```

Text may appear only in explanatory documentation or explicit “not included” copy, not as active controls.

- [ ] **Step 6: Push exact head and require GitHub Actions success**

Record the exact remote SHA and successful Actions URL in the PR. If the verification report is updated afterward, rerun CI on the new exact head.

- [ ] **Step 7: Commit**

```bash
git add README.md README.zh-TW.md CHANGELOG.md ROADMAP.md docs
git commit -m "docs: complete M3-A Web workspace verification"
```

## Self-review

### Spec coverage

- Snapshot contract and deterministic generation: Tasks 2–3.
- Framework-neutral layout and performance: Task 4.
- Simplified V2 shell and responsive behavior: Task 5.
- Search, filter, and keyboard operation discovery: Task 6.
- Read-only canvas and synchronized selection: Task 7.
- Inspectors, outline alternative, and diagnostics: Task 8.
- Browser boundary, accessibility, E2E, visual evidence, and CI: Task 9.
- Documentation, complete regression gate, and exact-head evidence: Task 10.

### Type consistency

- `ReadOnlyWorkspaceSnapshot` originates in Domain and is consumed by generator and Web loader.
- `FlowLayoutEngine` returns `PositionedFlowGraph`, consumed only by Web graph view-model construction.
- Selection uses `{ kind: 'node' | 'edge'; id: string } | null` across operations, canvas, outline, and inspector.
- All generated and displayed graph relationships remain `status: accepted`; M3-A does not materialize decisions.

### Scope confirmation

The plan produces a complete read-only vertical slice. Interactive review, mutation, persistence, workflow authoring, execution, mocking, and cloud behavior remain excluded.
