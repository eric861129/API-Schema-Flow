# M3-A Read-only Web Workspace Design

## Status

Approved for implementation by the repository owner on 2026-09-03 through the instruction to begin M3-A using the Branch + Draft PR workflow.

## Goal

Deliver the first browser-based API Schema Flow workspace: a clear, production-quality, read-only desktop interface that loads a deterministic local Project Snapshot, visualizes the accepted API operation graph, supports endpoint discovery and inspection, and exposes an accessible outline alternative without introducing editing, execution, mocking, or cloud services.

## Product boundary

M3-A is a visualization and exploration slice. It turns the stable M0–M2-D domain outputs into an inspectable Web experience but does not modify those outputs.

The slice includes:

1. a browser-safe Project Snapshot contract and deterministic Reservation fixture generator;
2. a framework-neutral ELK layout adapter;
3. a React + Vite Web application using the simplified V2 workspace layout;
4. operations search and method filtering;
5. synchronized list, canvas, node, edge, and inspector selection;
6. node and edge inspectors;
7. an accessible outline/table alternative;
8. loading, empty, unsupported, and error states;
9. unit, component, accessibility, end-to-end, bundle-boundary, and deterministic-fixture verification.

The slice explicitly excludes:

- OpenAPI or Arazzo drag-and-drop import;
- URL import from the browser;
- Accept, Reject, or Edit decision UI;
- writing decision files;
- dragging to create or change mappings;
- Workflow Builder editing;
- Arazzo source editing;
- Stateful Mock Runtime;
- Fastify or MSW runtime integration;
- workflow execution and Live Trace;
- cloud persistence, authentication, telemetry, or collaboration;
- PDF, Postman, or report export.

## Design principles

- The graph canvas is the hero area.
- One screen serves one primary task: understand the accepted API topology.
- Secondary information is progressively disclosed through collapsible panels.
- The right inspector is absent when nothing is selected.
- The bottom diagnostics drawer is collapsed by default.
- No floating review panel obscures the canvas.
- No control is shown for behavior that M3-A cannot perform.
- HTTP methods, provenance, selection, and severity never rely on color alone.
- Browser code consumes a prepared snapshot and never imports Node-only parsing, loading, review, or export runtimes.
- The canonical Reservation snapshot is generated, not hand-maintained.
- The same semantic input produces byte-identical snapshot JSON and deterministic node positions.

## Approved visual direction

M3-A follows the simplified V2 concept rather than the original information-dense concept.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ API Schema Flow │ Reservation System │ OpenAPI 3.1 │ View controls │
├──────┬──────────────────┬────────────────────────────┬───────────────┤
│ Icon │ Operations       │                            │ Inspector     │
│ Nav  │ Search / Filter  │       Graph Canvas         │ conditional   │
│      │ Endpoint List    │       primary region       │ and collapsible│
├──────┴──────────────────┴────────────────────────────┴───────────────┤
│ Workspace summary / diagnostics drawer — collapsed by default       │
└──────────────────────────────────────────────────────────────────────┘
```

Desktop layout targets:

- primary viewport: 1440 × 900;
- minimum acceptance viewport: 1366 × 768;
- icon rail: 56–64 px;
- operations panel: 240–280 px, collapsible;
- inspector: 360–420 px, conditional and collapsible;
- graph canvas: at least 60% of usable width when the inspector is closed;
- summary drawer: 40–48 px collapsed and no more than 35% of viewport height when expanded.

M3-A ships a dark professional workspace matching the accepted concept mockups. Theme tokens must be centralized so Light/System modes can be added later without rewriting components, but a theme switcher is outside this slice.

## Information architecture

The M3-A shell contains only destinations that are real in this slice:

- **Topology** — active read-only graph workspace;
- **Outline** — accessible list/table representation of the same graph;
- **Diagnostics** — opens the bottom drawer;
- **About** — compact build and fixture information.

Future destinations such as Workflows, Mock Runtime, Runs, and Exports are not rendered as disabled navigation items.

## Architecture

```text
Canonical Reservation sources and decisions
                  │
                  ▼
Node-side snapshot generator
  OpenAPI → declared graph → inference → review
                  │
                  ▼
Browser-safe deterministic Project Snapshot JSON
                  │
         ┌────────┴─────────┐
         ▼                  ▼
@api-schema-flow/layout     apps/web
ELK adapter                 React workspace
         │                  │
         └────────┬─────────┘
                  ▼
       positioned read-only graph
```

### Package responsibilities

#### `@api-schema-flow/domain`

Owns the browser-safe Project Snapshot contract because the contract is shared across generators, tests, and future clients. It must not gain a React or browser dependency.

#### `@api-schema-flow/layout`

Owns framework-neutral layout contracts and an ELK-backed implementation. It accepts `FlowGraph`, canonicalizes input ordering, invokes ELK, and returns positioned nodes and routable edges. It does not import React, React Flow, application state, source loaders, or execution runtimes.

#### `tooling/scripts/generate-web-workspace.mjs`

Runs in Node.js after workspace packages are built. It loads the canonical Reservation OpenAPI and Decision Set, executes the existing M2-D pipeline, constructs a browser-safe snapshot, redacts and validates it, serializes canonical JSON with a trailing newline, and writes `apps/web/public/fixtures/reservation-workspace.json`.

#### `apps/web`

Owns React components, browser state, view models, styling, routing between Topology and Outline, fixture loading, and user interactions. It consumes only browser-safe workspace packages and static JSON.

## Project Snapshot contract

Add a versioned contract similar to:

```ts
export const READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION = '1.0' as const

export interface ReadOnlyWorkspaceProject {
  readonly name: string
  readonly sourceName: string
  readonly sourceUri: string
  readonly openapiVersion: string
}

export interface ReadOnlyWorkspaceSnapshot {
  readonly schemaVersion: typeof READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION
  readonly generatedBy: {
    readonly package: 'api-schema-flow'
    readonly milestone: 'M3-A'
  }
  readonly project: ReadOnlyWorkspaceProject
  readonly apiDocument: NormalizedApiDocument
  readonly acceptedGraph: FlowGraph
  readonly inferenceCandidates: readonly InferenceCandidate[]
  readonly reviewOutcomes: readonly ReviewDecisionOutcome[]
  readonly diagnostics: readonly Diagnostic[]
}
```

Snapshot rules:

- contains no runtime secrets, examples, or defaults rejected by the existing redaction policy;
- contains no absolute local file paths;
- uses a stable project-relative source URI such as `fixture://reservation/openapi.yaml`;
- contains accepted graph edges only;
- may retain inference candidates and review outcomes for read-only evidence display;
- is sorted deterministically before serialization;
- validates that every graph endpoint node binds to exactly one operation;
- validates that every edge references existing nodes;
- is safe to expose as a public static asset.

## Snapshot generation

The generator uses existing public package APIs rather than reimplementing parsing or inference.

Expected pipeline:

```text
Read canonical fixture files
      ↓
Acquire and process OpenAPI
      ↓
Build declared operation graph
      ↓
Run deterministic inference
      ↓
Parse decision set
      ↓
Materialize reviewed operation graph
      ↓
Build browser-safe Project Snapshot
      ↓
Canonicalize + scan + serialize
      ↓
Write reservation-workspace.json
```

The generator fails when:

- source processing emits a blocking error;
- decisions cannot be parsed;
- graph materialization emits an error;
- a graph node cannot bind to an operation;
- the snapshot contains an absolute path;
- representative secret patterns appear;
- generation is nondeterministic.

Root scripts:

```text
pnpm generate:web-fixture
pnpm check:web-fixture
```

`check:web-fixture` generates to a temporary file and compares exact bytes with the committed fixture.

## Layout contract

```ts
export type FlowLayoutDirection = 'right' | 'down'

export interface FlowLayoutOptions {
  readonly direction: FlowLayoutDirection
  readonly nodeWidth: number
  readonly nodeHeight: number
  readonly nodeSpacing: number
  readonly layerSpacing: number
}

export interface PositionedFlowNode {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PositionedFlowEdge {
  readonly id: string
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly sections: readonly {
    readonly startPoint: { readonly x: number; readonly y: number }
    readonly bendPoints: readonly { readonly x: number; readonly y: number }[]
    readonly endPoint: { readonly x: number; readonly y: number }
  }[]
}

export interface PositionedFlowGraph {
  readonly graphId: string
  readonly width: number
  readonly height: number
  readonly nodes: readonly PositionedFlowNode[]
  readonly edges: readonly PositionedFlowEdge[]
}

export interface FlowLayoutEngine {
  layout(graph: FlowGraph, options: FlowLayoutOptions): Promise<PositionedFlowGraph>
}
```

Layout behavior:

- input nodes and edges are sorted before creating the ELK graph;
- rightward layout is the default;
- disconnected nodes are laid out rather than dropped;
- cycles must not throw or hang;
- empty and single-node graphs return valid dimensions;
- returned arrays are deterministically sorted by stable ID;
- UI-only position data never mutates `FlowGraph`;
- a 500-node synthetic graph completes under a documented CI threshold.

## Browser boundary

`apps/web` may import:

- React and React DOM;
- `@xyflow/react`;
- `@api-schema-flow/domain` types and browser-safe values;
- `@api-schema-flow/layout`;
- small browser-safe utility packages approved in the package manifest.

`apps/web` must not import:

- Node.js built-ins;
- `@api-schema-flow/source-loader`;
- parser implementations;
- `@api-schema-flow/openapi`;
- `@api-schema-flow/arazzo`;
- `@api-schema-flow/review`;
- `@api-schema-flow/exporter-arazzo`;
- CLI modules;
- Fastify, Hono, MSW, mock, or execution runtimes.

The production bundle is scanned for Node built-ins and prohibited workspace package names.

## Web state model

M3-A uses small, explicit local state instead of a global state framework.

```ts
interface WorkspaceViewState {
  readonly activeView: 'topology' | 'outline'
  readonly selectedElement:
    | { readonly kind: 'node'; readonly id: string }
    | { readonly kind: 'edge'; readonly id: string }
    | null
  readonly query: string
  readonly methods: readonly HttpMethod[]
  readonly operationsPanelOpen: boolean
  readonly inspectorOpen: boolean
  readonly diagnosticsOpen: boolean
  readonly layoutDirection: FlowLayoutDirection
}
```

Rules:

- list selection and canvas selection share one selected-element source of truth;
- changing filters never deletes semantic data;
- if a selected element becomes hidden, selection is cleared and focus returns to a predictable control;
- closing the inspector clears neither the selection nor semantic data; selecting another element reopens it;
- view state is session-only in M3-A and is not written to project files;
- no state transition calls a Node-only package or remote API.

## Fixture loading and application states

The Web app loads `/fixtures/reservation-workspace.json` through `fetch`.

Application states:

- **loading** — skeleton shell with a text status;
- **ready** — normal workspace;
- **error** — concrete error message, retry button, and fixture path;
- **empty** — project summary and explanation that no operations were found;
- **unsupported snapshot** — supported and received schema versions;
- **filter empty** — explains that current search/filter settings hide all operations and offers Clear filters.

The app validates essential snapshot structure at runtime without importing the Node-side parser pipeline.

## Operations panel

Features:

- search by path, summary, and `operationId`;
- HTTP method filters;
- grouping by first tag, with `Untagged` fallback;
- visible result count;
- selected and focused states;
- Arrow Up/Down navigation within visible operations;
- Enter selects and focuses the corresponding canvas node;
- Escape clears search or selection according to focus context;
- panel collapse button with an accessible name.

Operation rows show:

- textual HTTP method badge;
- path;
- summary or `operationId`;
- incoming/outgoing connection counts;
- diagnostic marker when applicable.

## Graph canvas

Use `@xyflow/react` in controlled read-only mode.

M3-A disables:

- node dragging persistence;
- connection creation;
- edge updates;
- deletion;
- multi-select mutation commands;
- editable handles.

M3-A allows:

- pan;
- zoom;
- Fit View;
- focus selected node;
- selecting nodes and edges;
- switching layout direction;
- opening the corresponding inspector;
- keyboard focus on nodes.

Endpoint node content:

```text
[METHOD] /path
summary or operationId
Tag · incoming count · outgoing count
```

Node colors are secondary. Method text and a method-specific marker remain visible in monochrome.

Edge visual encoding:

- Declared — solid line and `Declared` text in the inspector;
- Accepted inferred — dashed line and `Accepted inferred` text;
- Manual — solid line with diamond marker and `Manual` text;
- Data mapping label — compact `source → target` summary;
- Selected — width and outline change in addition to color.

Control or dependency edges are supported by the view model but the canonical M3-A operation graph focuses on data edges.

## Inspector

The inspector renders only after selecting a node or edge and may be collapsed independently.

### Node inspector

Sections:

- Overview — method, path, operation ID, summary, tags, security, source pointer;
- Request — parameters and request body schema summary;
- Responses — statuses, media types, and schema summary;
- Connections — incoming and outgoing mappings with buttons that select the related edge.

M3-A schema rendering is intentionally shallow: object properties are displayed to a bounded depth and recursive references are marked. A full recursive schema explorer is deferred.

### Edge inspector

Sections:

- source operation and selector;
- target operation and target descriptor;
- mapping alias and transform summary;
- provenance and accepted status;
- review metadata and candidate derivation when present;
- evidence rule IDs;
- declared source references or source pointer when available.

No edit actions are rendered.

## Outline alternative

The Outline view provides equivalent semantic information without requiring spatial graph interaction.

It includes:

- an operation table with method, path, tag, incoming, and outgoing counts;
- expandable connection rows;
- a mapping table with source operation, source selector, target operation, target descriptor, provenance, and status;
- the same search and method filters;
- buttons that select the same node or edge and open the inspector;
- heading and table semantics suitable for screen readers.

The outline is not a simplified screenshot of the canvas; it is an independent accessible representation driven from the same view model.

## Diagnostics drawer

The collapsed drawer shows:

```text
Ready · 4 operations · 3 accepted relationships · 0 blocking errors
```

Expanded content shows diagnostics sorted by severity, code, and source. Each row includes severity text, diagnostic code, message, and source pointer. The drawer does not display runtime values or unredacted examples.

## Styling and design tokens

Use Tailwind CSS with CSS custom properties for semantic tokens:

```text
--surface-canvas
--surface-panel
--surface-elevated
--border-muted
--text-primary
--text-secondary
--accent
--success
--warning
--danger
--method-get
--method-post
--method-put
--method-patch
--method-delete
```

Guidelines:

- base body text is at least 14 px;
- metadata is at least 12 px and used sparingly;
- endpoint paths use a readable monospace stack;
- nested cards are avoided when spacing and dividers communicate hierarchy;
- focus rings meet WCAG 2.2 AA visibility expectations;
- contrast targets WCAG 2.2 AA;
- motion is subtle and disabled under `prefers-reduced-motion`.

## Accessibility requirements

MUST:

- provide an accessible name for every icon-only button;
- expose nodes as keyboard-focusable controls;
- offer the complete Outline alternative;
- support keyboard-only search, filter, selection, inspector opening, and closing;
- preserve visible focus at 200% zoom;
- use `aria-current` or equivalent for active navigation;
- return focus to the triggering element when closing a temporary overlay;
- never use color as the only state or provenance encoding;
- honor reduced-motion preferences;
- keep live-region announcements concise and limited to loading/error transitions;
- pass automated axe checks for the canonical journey with no serious or critical violations.

## Performance targets

- initial committed Reservation fixture remains below 250 KB uncompressed;
- production JavaScript chunks are reported in CI;
- the canonical 4-node graph becomes interactive without visible layout shift after the loading state;
- 500-node layout completes within 5 seconds in CI;
- search/filter interaction on a 500-operation synthetic view model completes within 100 ms in the unit benchmark;
- no Node built-in polyfill is included in the browser bundle.

## Testing strategy

### Domain and generator tests

- snapshot contract serializes and validates;
- canonical generation is deterministic across repeated runs;
- reordered semantic inputs produce identical bytes;
- accepted graph contains no candidate or rejected edge;
- snapshot contains no absolute path or representative secret;
- `check:web-fixture` detects drift.

### Layout tests

- empty graph;
- single node;
- connected DAG;
- disconnected nodes;
- cycle;
- right/down direction;
- input-order determinism;
- stable output sorting;
- 500-node performance gate.

### React component tests

- loading, ready, error, empty, unsupported, and filter-empty states;
- operations grouping, search, method filter, and count;
- keyboard navigation;
- list/canvas selection synchronization;
- node and edge inspectors;
- panel collapse/expand behavior;
- Outline table equivalence;
- diagnostics drawer;
- no edit controls in M3-A.

### End-to-end tests

Canonical Playwright journey:

```text
Load Reservation workspace
→ search “reservations”
→ select POST /reservations
→ verify canvas focus and node inspector
→ select reservationId mapping edge
→ verify provenance and mapping inspector
→ switch to Outline
→ verify equivalent connection
→ operate panels with keyboard
```

Viewports:

- 1440 × 900;
- 1366 × 768.

The end-to-end suite includes automated accessibility scanning and a small set of stable screenshots for the topology, node inspector, edge inspector, and outline views.

## CI changes

CI adds:

- frozen dependency installation including Web dependencies;
- deterministic Web fixture drift check;
- Layout unit and performance tests;
- Web component tests;
- production Web build;
- browser bundle boundary scan;
- Playwright browser installation with caching where practical;
- canonical desktop E2E and accessibility checks.

The existing M0–M2-D verification remains mandatory.

## Package boundaries

Add automated rules:

- `layout` may depend only on `domain` and `elkjs` at runtime;
- `layout` must not import React, React Flow, source loading, parser, review, export, mock, execution, server, or CLI packages;
- `apps/web` must not import Node built-ins or Node-only workspace packages;
- `domain` must remain free of UI and layout dependencies;
- fixture generation is the only M3-A code allowed to compose OpenAPI, Flow, Inference, and Review packages;
- browser bundle output must not contain prohibited package identifiers.

## Acceptance criteria

M3-A is complete when all of the following are true:

1. `pnpm dev:web` starts the Web app.
2. The committed Reservation snapshot is generated from canonical project fixtures and passes exact-byte drift verification.
3. The workspace renders 4 endpoint nodes and the accepted relationships from M2-D.
4. Operations list, canvas, outline, and inspector use one synchronized selection model.
5. Search and HTTP method filters work with mouse and keyboard.
6. Node inspector displays normalized OpenAPI operation information.
7. Edge inspector displays mapping, provenance, accepted status, and review/evidence metadata.
8. Declared, accepted inferred, and manual relationships are not distinguished by color alone.
9. Operations panel and inspector are collapsible.
10. The diagnostics drawer is collapsed by default and contains stable diagnostics when expanded.
11. The canonical journey works at 1440 × 900 and 1366 × 768 without overlapping primary regions.
12. The complete graph meaning is available through the keyboard-accessible Outline view.
13. Reduced-motion mode remains fully understandable.
14. Layout and fixture output are deterministic across repeated and reordered inputs.
15. The browser production bundle contains no Node-only package or built-in dependency.
16. Snapshot and built assets contain no representative secret or absolute local path.
17. Existing M0–M2-D tests remain green.
18. Web unit, integration, E2E, accessibility, bundle-boundary, and visual checks pass on the exact PR head.

## Follow-up boundary

M3-B may add interactive inference review, Decision Set save/load, and accepted-graph regeneration. M3-A components must therefore expose selection and presentation interfaces that M3-B can reuse, but M3-A must not include hidden mutation logic or dormant edit controls.
