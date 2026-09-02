# M2-B Declared Flow Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, parser-independent declared flow graph that projects OpenAPI Links and Arazzo workflow semantics into provenance-aware operation and workflow graphs without inference, execution, or Web UI.

**Architecture:** Add stable graph vocabulary to `@api-schema-flow/domain` and a new `@api-schema-flow/flow` composition package. The flow package consumes only public OpenAPI and Arazzo contracts, projects declared control/dependency/data relationships, merges equivalent mappings across standards, and returns serializable graphs plus diagnostics.

**Tech Stack:** TypeScript 6, Node.js 24, pnpm 11, Turborepo, Vitest 4, existing OpenAPI/Arazzo/domain/diagnostics packages.

**Spec:** `docs/superpowers/specs/2026-09-02-m2b-declared-flow-graph-design.md`

## Global Constraints

- Every M2-B edge has `provenance: 'declared'` and `status: 'accepted'`.
- M2-B emits no inferred candidates, confidence values, review decisions, or execution behavior.
- `@api-schema-flow/openapi` and `@api-schema-flow/arazzo` remain mutually independent.
- `@api-schema-flow/flow` may consume both packages only through their public roots.
- Graph IDs depend on caller-supplied stable source IDs, never timestamps, random values, absolute temporary paths, UI positions, or runtime payloads.
- Equivalent mappings from different standards merge while retaining all source-standard references.
- Unresolved or ambiguous targets never create dangling edges.
- Graph output contains structural selectors only and never stores evaluated secrets, credentials, cookies, or request/response instances.
- Header names compare case-insensitively where HTTP semantics require it.
- JSON Pointer fragments use RFC 6901 escaping.
- Output arrays and diagnostics are deterministic.
- Existing OpenAPI, Arazzo, CLI, source-loader, and package-boundary behavior must remain unchanged.
- No React, React Flow, ELK, Fastify, MSW, workflow execution, Arazzo export, or inference is introduced.

---

### Task 1: Shared Flow Domain Contracts

**Files:**
- Create: `packages/domain/src/flow-node.ts`
- Create: `packages/domain/src/flow-value.ts`
- Create: `packages/domain/src/flow-edge.ts`
- Create: `packages/domain/src/flow-graph.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/tests/unit/flow-contract.test.ts`

**Interfaces:**
- Produces: `FlowGraphKind`, `FlowNode`, `EndpointFlowNode`, `WorkflowStepFlowNode`, `FlowValueSelector`, `FlowValueTarget`, `FlowValueAlias`, `FlowValueTransform`, `FlowDataMapping`, `FlowEdgeKind`, `FlowEdgeProvenance`, `FlowEdgeStatus`, `SourceStandard`, `SourceStandardRef`, `FlowEdge`, and `FlowGraph`.
- These interfaces are serializable data contracts and contain no methods or framework types.

- [ ] **Step 1: Write failing contract tests**

Create `packages/domain/tests/unit/flow-contract.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import type {
  EndpointFlowNode,
  FlowDataMapping,
  FlowEdge,
  FlowGraph,
  WorkflowStepFlowNode,
} from '../../src/index.js'

const endpoint: EndpointFlowNode = {
  kind: 'endpoint',
  id: 'endpoint:reservationApi:operation:post:/reservations',
  sourceId: 'reservationApi',
  operationKey: 'operation:post:/reservations',
  method: 'post',
  path: '/reservations',
  operationId: 'createReservation',
  source: { uri: 'memory://openapi', pointer: '#/paths/~1reservations/post' },
}

const step: WorkflowStepFlowNode = {
  kind: 'workflow-step',
  id: 'workflow-step:reservationWorkflow:createReservation:create',
  sourceId: 'reservationWorkflow',
  workflowId: 'createReservation',
  stepId: 'create',
  operationKey: 'operation:post:/reservations',
  source: { uri: 'memory://arazzo', pointer: '#/workflows/0/steps/0' },
}

const mapping: FlowDataMapping = {
  id: 'mapping:response-body:#/id->path-parameter:id',
  source: { kind: 'response-body', pointer: '#/id' },
  target: { kind: 'path-parameter', name: 'id' },
  aliases: [],
  sourcePointers: [],
}

const edge: FlowEdge = {
  id: 'edge:data:a:b:mapping',
  kind: 'data',
  sourceNodeId: endpoint.id,
  targetNodeId: step.id,
  provenance: 'declared',
  status: 'accepted',
  mappings: [mapping],
  sourceStandardRefs: [],
}

const graph: FlowGraph = {
  schemaVersion: '1.0',
  id: 'graph:operation-topology:reservationApi',
  kind: 'operation-topology',
  title: 'Operation topology',
  sourceIds: ['reservationApi'],
  nodes: [endpoint],
  edges: [edge],
}

describe('flow domain contracts', () => {
  test('remain plain serializable values', () => {
    expect(JSON.parse(JSON.stringify({ endpoint, step, graph }))).toEqual({ endpoint, step, graph })
  })

  test('model declared accepted data mappings without parser types', () => {
    expect(edge).toMatchObject({
      kind: 'data',
      provenance: 'declared',
      status: 'accepted',
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @api-schema-flow/domain test -- flow-contract
```

Expected: FAIL because the exported flow contracts do not exist.

- [ ] **Step 3: Implement the four domain files**

Use exact discriminants and properties from the approved design. `FlowValueSelector` literals permit only `string | number | boolean | null`.

- [ ] **Step 4: Export the contracts from `packages/domain/src/index.ts`**

Add explicit named type exports; do not use deep imports or parser types.

- [ ] **Step 5: Run domain tests and typecheck**

```bash
pnpm --filter @api-schema-flow/domain test
pnpm --filter @api-schema-flow/domain typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src packages/domain/tests/unit/flow-contract.test.ts
git commit -m "feat(domain): add declared flow graph contracts"
```

### Task 2: Flow Package Scaffold and Canonical Identity

**Files:**
- Create: `packages/flow/package.json`
- Create: `packages/flow/tsconfig.json`
- Create: `packages/flow/src/index.ts`
- Create: `packages/flow/src/canonical.ts`
- Create: `packages/flow/src/graph-assembler.ts`
- Create: `packages/flow/tests/unit/canonical.test.ts`
- Create: `packages/flow/tests/unit/graph-assembler.test.ts`
- Modify: `pnpm-lock.yaml`
- Modify: `tooling/scripts/check-workspace.mjs`
- Modify: `tooling/scripts/check-boundaries.mjs`

**Interfaces:**
- Consumes the Task 1 graph contracts.
- Produces:

```ts
canonicalizeJson(value: unknown): string
createEndpointNodeId(sourceId: string, operationKey: string): string
createWorkflowStepNodeId(sourceId: string, workflowId: string, stepId: string): string
createMappingId(source: FlowValueSelector, target: FlowValueTarget, transform?: FlowValueTransform): string
createEdgeId(kind: FlowEdgeKind, sourceNodeId: string, targetNodeId: string, mappings: readonly FlowDataMapping[]): string
createOperationGraphId(sourceIds: readonly string[]): string
createWorkflowGraphId(sourceId: string, workflowId: string): string
assembleFlowGraph(input: AssembleFlowGraphInput): AssembleFlowGraphResult
```

- `assembleFlowGraph()` merges duplicate nodes, edges, mappings, aliases, pointers, and standard references deterministically.

- [ ] **Step 1: Write failing canonical identity tests**

```ts
expect(createEndpointNodeId('reservationApi', 'operation:post:/reservations')).toBe(
  'endpoint:reservationApi:operation:post:/reservations',
)

expect(createWorkflowStepNodeId('workflow', 'createReservation', 'login')).toBe(
  'workflow-step:workflow:createReservation:login',
)

expect(
  createMappingId(
    { kind: 'response-body', pointer: '#/id' },
    { kind: 'path-parameter', name: 'id' },
  ),
).toBe(
  createMappingId(
    { pointer: '#/id', kind: 'response-body' },
    { name: 'id', kind: 'path-parameter' },
  ),
)
```

Also assert that source-standard references and aliases do not affect edge identity.

- [ ] **Step 2: Run canonical tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- canonical
```

Expected: FAIL because the package and functions do not exist.

- [ ] **Step 3: Create the package manifest and lockfile importer**

`packages/flow/package.json` uses workspace dependencies on domain, diagnostics, openapi, and arazzo. It adds no external dependency.

Add the exact importer:

```yaml
packages/flow:
  dependencies:
    '@api-schema-flow/arazzo':
      specifier: workspace:*
      version: link:../arazzo
    '@api-schema-flow/diagnostics':
      specifier: workspace:*
      version: link:../diagnostics
    '@api-schema-flow/domain':
      specifier: workspace:*
      version: link:../domain
    '@api-schema-flow/openapi':
      specifier: workspace:*
      version: link:../openapi
```

- [ ] **Step 4: Implement canonical JSON and readable IDs**

Canonical JSON recursively sorts object keys, preserves array order, omits `undefined`, and rejects non-finite numbers. IDs use the exact prefixes from the design.

- [ ] **Step 5: Write failing assembler tests**

Test that:

- equal endpoint nodes merge;
- conflicting equal node IDs emit `ASF-FLW-1001`;
- equal data edges merge source refs;
- equal mappings merge aliases and source pointers;
- output is sorted by ID;
- no candidate or inferred edge can enter the assembler.

- [ ] **Step 6: Run assembler tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- graph-assembler
```

Expected: FAIL because the assembler does not exist.

- [ ] **Step 7: Implement `assembleFlowGraph()`**

Return:

```ts
interface AssembleFlowGraphResult {
  readonly graph: FlowGraph
  readonly diagnostics: readonly Diagnostic[]
}
```

Reject non-`declared + accepted` edges with `ASF-FLW-1008` rather than mutating them.

- [ ] **Step 8: Extend workspace and boundary checks**

- Add `flow` to `requiredPackages`.
- Permit `flow` to import the OpenAPI and Arazzo public roots.
- Reject React, `@xyflow/react`, ELK, Fastify, and MSW imports inside `packages/flow`.
- Preserve the existing mutual OpenAPI/Arazzo prohibition.

- [ ] **Step 9: Run package and architecture gates**

```bash
pnpm install --frozen-lockfile
pnpm --filter @api-schema-flow/flow build
pnpm --filter @api-schema-flow/flow typecheck
pnpm --filter @api-schema-flow/flow test
pnpm workspace:check
pnpm boundaries:check
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/flow pnpm-lock.yaml tooling/scripts
git commit -m "feat(flow): add deterministic graph assembly"
```

### Task 3: OpenAPI Link Projection

**Files:**
- Create: `packages/flow/src/expression-selector.ts`
- Create: `packages/flow/src/target-parameter.ts`
- Create: `packages/flow/src/openapi-link-projector.ts`
- Modify: `packages/flow/src/index.ts`
- Modify: `packages/diagnostics/src/codes.ts`
- Test: `packages/flow/tests/unit/expression-selector.test.ts`
- Test: `packages/flow/tests/unit/openapi-link-projector.test.ts`

**Interfaces:**
- Produces:

```ts
runtimeExpressionToSelector(expression: RuntimeExpression): FlowValueSelector | undefined
resolveLinkParameterTarget(operation: NormalizedOperation, target: string): FlowValueTarget | undefined
projectOpenApiLinks(source: FlowOpenApiSource): FlowProjectionFragment
```

- `FlowProjectionFragment` contains `nodes`, `edges`, and `diagnostics` but is not yet a full graph.

- [ ] **Step 1: Write failing expression-selector tests**

Cover:

```text
$response.body#/id      -> response-body
$response.header.ETag   -> response-header
$request.body#/user/id  -> request-body
$request.header.X-Trace -> request-header
$request.query.filter   -> request-query
$request.path.id        -> request-path
$statusCode             -> status-code
```

Reject Arazzo-only named, step-output, workflow-output, component, message, and source-operation expressions.

- [ ] **Step 2: Run focused selector tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- expression-selector
```

Expected: FAIL because the conversion function does not exist.

- [ ] **Step 3: Implement selector conversion**

Use the typed Arazzo Runtime Expression AST already produced by M2-A. Do not parse strings by hand in the projector.

- [ ] **Step 4: Write failing OpenAPI Link projection tests**

Construct a normalized document with:

```yaml
POST /reservations
  response 201 link:
    parameters:
      id: $response.body#/id
      header.X-Trace: $request.header.X-Trace
    requestBody:
      reservationId: $response.body#/id

GET /reservations/{id}
```

Assert:

- endpoint nodes are created for both operations;
- one declared accepted data edge connects them;
- unqualified `id` resolves to the path parameter;
- `header.X-Trace` resolves directly;
- request body mapping uses `#/reservationId`;
- source refs point at the Link object and mapping fields;
- unresolved `resolvedOperationKey` emits `ASF-FLW-1002` and no edge;
- ambiguous unqualified target emits `ASF-FLW-1003` and no mapping;
- secret-shaped literal targets are omitted.

- [ ] **Step 5: Run projector tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- openapi-link-projector
```

Expected: FAIL because the projector does not exist.

- [ ] **Step 6: Implement target qualification**

Recognize prefixes:

```text
path.
query.
querystring.
header.
cookie.
```

For unqualified names, inspect target-operation parameters. Header names compare case-insensitively.

- [ ] **Step 7: Implement recursive Link request-body mapping**

Traverse arrays and objects. Only strings containing valid runtime expressions or templates create mappings. Literals do not create inter-operation edges.

- [ ] **Step 8: Implement Link edge assembly**

Group mappings by source-target endpoint pair. Create edge and mapping IDs through canonical helpers. Use `openapi-link` source refs.

- [ ] **Step 9: Run package tests and typecheck**

```bash
pnpm --filter @api-schema-flow/flow test
pnpm --filter @api-schema-flow/flow typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/flow packages/diagnostics/src/codes.ts
git commit -m "feat(flow): project OpenAPI Links into declared edges"
```

### Task 4: Arazzo Workflow Nodes, Control Edges, and Dependency Edges

**Files:**
- Create: `packages/flow/src/operation-catalog.ts`
- Create: `packages/flow/src/arazzo-workflow-projector.ts`
- Modify: `packages/flow/src/index.ts`
- Test: `packages/flow/tests/unit/operation-catalog.test.ts`
- Test: `packages/flow/tests/unit/arazzo-workflow-projector.test.ts`

**Interfaces:**
- Produces:

```ts
createArazzoOperationCatalogs(openApiSources: readonly FlowOpenApiSource[]): readonly ArazzoOperationCatalog[]
projectArazzoWorkflowStructure(
  source: FlowArazzoSource,
  openApiSources: readonly FlowOpenApiSource[],
): ArazzoWorkflowProjectionFragment
```

- The fragment returns workflow-step nodes, workflow control/dependency edges, operation-topology control/dependency edges, resolution metadata, and diagnostics.

- [ ] **Step 1: Write failing catalog tests**

Assert that a bound OpenAPI source:

```ts
{
  sourceId: 'reservationApi',
  sourceName: 'reservationApi',
  document,
}
```

creates a catalog with operation keys, `operationId`, and operation source-pointer `operationPath` values.

Unbound sources without `sourceName` do not become Arazzo catalogs.

- [ ] **Step 2: Run catalog tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- operation-catalog
```

Expected: FAIL because catalog construction is missing.

- [ ] **Step 3: Implement catalog construction**

Use only public normalized operation fields. Do not import OpenAPI package internals.

- [ ] **Step 4: Write failing workflow-structure tests**

Use a four-step Reservation workflow. Assert:

- four workflow-step nodes;
- operation binding on every node;
- three adjacent control edges;
- three explicit dependency edges;
- all edges are declared and accepted;
- missing operation binding emits `ASF-FLW-1004`;
- ambiguous operation binding emits `ASF-FLW-1005`;
- missing `dependsOn` step emits `ASF-FLW-1006` and no dangling edge;
- operation topology receives matching control/dependency relationships only when both endpoint bindings resolve.

- [ ] **Step 5: Run workflow tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- arazzo-workflow-projector
```

Expected: FAIL because workflow projection is missing.

- [ ] **Step 6: Implement step nodes and resolution mapping**

Use `resolveArazzoOperations()` with the catalogs. Create one node per step even when operation resolution fails. Attach `operationKey` only for resolved targets.

- [ ] **Step 7: Implement control and dependency edges**

- Control: adjacent step-array pairs.
- Dependency: explicit `dependsOn` entries only.
- Do not convert implicit Runtime Expression dependencies into dependency edges.

- [ ] **Step 8: Run tests and typecheck**

```bash
pnpm --filter @api-schema-flow/flow test
pnpm --filter @api-schema-flow/flow typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/flow
git commit -m "feat(flow): project Arazzo workflow structure"
```

### Task 5: Arazzo Data Mapping Projection

**Files:**
- Create: `packages/flow/src/arazzo-value-projector.ts`
- Modify: `packages/flow/src/arazzo-workflow-projector.ts`
- Modify: `packages/flow/src/index.ts`
- Test: `packages/flow/tests/unit/arazzo-value-projector.test.ts`
- Test: `packages/flow/tests/unit/arazzo-data-edge.test.ts`

**Interfaces:**
- Produces:

```ts
collectArazzoStepOutputUses(value: NormalizedArazzoValue): readonly ArazzoStepOutputUse[]
resolveArazzoStepOutputSelector(
  workflow: NormalizedArazzoWorkflow,
  stepId: string,
  outputName: string,
): ResolvedStepOutputSelector
projectArazzoStepMappings(...): FlowProjectionFragment
```

- `ArazzoStepOutputUse` records the referenced source step/output, optional template raw value, and target source pointer.

- [ ] **Step 1: Write failing value traversal tests**

Assert recursive discovery in:

- a pure step-output expression;
- `Bearer {$steps.login.outputs.token}`;
- nested object request bodies;
- arrays;
- literal values with no expressions.

- [ ] **Step 2: Run value tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- arazzo-value-projector
```

Expected: FAIL because traversal and output resolution are missing.

- [ ] **Step 3: Implement recursive traversal**

Return deterministic uses sorted by source step ID, output name, and target pointer. Template uses retain the original template raw string as a transform.

- [ ] **Step 4: Implement output selector resolution**

Resolve output values only when they are a single supported selector or a single supported selector in a template. Supported selectors match Section 13 of the design. Unsupported compound output semantics emit `ASF-FLW-1008`.

- [ ] **Step 5: Write failing Reservation data-edge tests**

The workflow must produce exactly five workflow data edges:

```text
login.token -> listSpaces.Authorization
login.token -> createReservation.Authorization
login.token -> getReservation.Authorization
listSpaces.spaceId -> createReservation.body#/spaceId
createReservation.reservationId -> getReservation.path.id
```

Assert aliases, template transforms, mapping source pointers, edge source refs, and operation-topology equivalents.

- [ ] **Step 6: Run data-edge tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- arazzo-data-edge
```

Expected: FAIL because data-edge projection is missing.

- [ ] **Step 7: Implement parameter and request-body targets**

Map parameter locations exactly. Traverse request-body payload objects and arrays using escaped JSON Pointer tokens.

- [ ] **Step 8: Implement workflow and operation data edges**

Create workflow edges between step nodes. Create operation-topology equivalents only when both operation bindings resolve. Underlying selectors, not step-output alias names, define mapping identity.

- [ ] **Step 9: Run tests and typecheck**

```bash
pnpm --filter @api-schema-flow/flow test
pnpm --filter @api-schema-flow/flow typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/flow
git commit -m "feat(flow): project Arazzo data mappings"
```

### Task 6: Declared Graph Builder and Multi-standard Deduplication

**Files:**
- Create: `packages/flow/src/build-declared-flow-graphs.ts`
- Modify: `packages/flow/src/index.ts`
- Test: `packages/flow/tests/unit/build-declared-flow-graphs.test.ts`

**Interfaces:**
- Produces the approved public entry point:

```ts
buildDeclaredFlowGraphs(input: BuildDeclaredFlowGraphsInput): DeclaredFlowProjection
```

- [ ] **Step 1: Write failing end-to-end builder tests**

Assert:

- standalone OpenAPI creates an operation graph and no workflow graphs;
- Arazzo creates one workflow graph per workflow;
- source IDs are sorted;
- repeated builds are deeply equal;
- all edges are declared and accepted;
- no edge has `confidence` or candidate status;
- unresolved mappings do not create dangling edges;
- equivalent OpenAPI Link and Arazzo mappings merge into one operation data edge with both source standards.

- [ ] **Step 2: Run builder tests and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test -- build-declared-flow-graphs
```

Expected: FAIL because the public builder is missing.

- [ ] **Step 3: Implement fragment composition**

Collect endpoint nodes once, project all OpenAPI Links, project each Arazzo workflow, then run graph assembly separately for operation topology and each workflow instance.

- [ ] **Step 4: Implement cross-standard edge merge**

Mapping identity ignores aliases and source pointers. Edge identity ignores standard references. Merge retains both `openapi-link` and `arazzo` references.

- [ ] **Step 5: Add graph-level invariant checks**

Before returning, verify every edge endpoint exists and every edge is declared/accepted. Emit `ASF-FLW-1002` or `ASF-FLW-1008` and remove only invalid edges.

- [ ] **Step 6: Run all flow tests**

```bash
pnpm --filter @api-schema-flow/flow test
pnpm --filter @api-schema-flow/flow build
pnpm --filter @api-schema-flow/flow typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/flow
git commit -m "feat(flow): build declared operation and workflow graphs"
```

### Task 7: Golden Fixtures and Integration Verification

**Files:**
- Create: `fixtures/flow/declared/openapi-link/openapi.yaml`
- Create: `fixtures/flow/declared/openapi-link/expected-operation-graph.json`
- Create: `fixtures/flow/declared/arazzo-reservation/expected-projection.json`
- Create: `packages/flow/tests/integration/openapi-link-golden.integration.test.ts`
- Create: `packages/flow/tests/integration/arazzo-reservation-golden.integration.test.ts`
- Create: `packages/flow/tests/helpers/load-fixture.ts`
- Modify: `examples/reservation/README.md`

**Interfaces:**
- Integration tests parse the public OpenAPI/Arazzo fixtures through public package APIs, then call `buildDeclaredFlowGraphs()`.
- Golden JSON is parser-independent and directly serializable for future UI tests.

- [ ] **Step 1: Add the OpenAPI Link fixture**

Include:

```text
POST /reservations response.id
  -> GET /reservations/{id} path.id
```

Use only synthetic values and no credentials.

- [ ] **Step 2: Write failing OpenAPI golden test**

Parse the fixture with the public OpenAPI pipeline, build the graph, and compare exact JSON with `expected-operation-graph.json`.

- [ ] **Step 3: Run the OpenAPI golden test and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test:integration -- openapi-link-golden
```

Expected: FAIL because the expected golden file is missing or differs.

- [ ] **Step 4: Generate and review the OpenAPI golden JSON**

The expected graph contains two endpoint nodes and one declared accepted data edge.

- [ ] **Step 5: Write failing Reservation golden test**

Load:

```text
examples/reservation/openapi.yaml
fixtures/arazzo/valid/reservation.yaml
```

Bind the OpenAPI source as `reservationApi`, build the projection, and compare exact JSON with `expected-projection.json`.

- [ ] **Step 6: Run the Reservation golden test and verify RED**

```bash
pnpm --filter @api-schema-flow/flow test:integration -- arazzo-reservation-golden
```

Expected: FAIL because the expected projection is missing or differs.

- [ ] **Step 7: Generate and review the Reservation golden JSON**

Verify acceptance counts:

```text
Operation nodes: 4
Workflow-step nodes: 4
Workflow control edges: 3
Workflow dependency edges: 3
Workflow data edges: 5
All provenance: declared
All status: accepted
```

- [ ] **Step 8: Verify deterministic JSON**

Build twice and assert:

```ts
expect(JSON.stringify(first, null, 2)).toBe(JSON.stringify(second, null, 2))
```

Also assert the serialized output excludes `token` runtime values and contains only selector names/pointers.

- [ ] **Step 9: Run integration and regression suites**

```bash
pnpm --filter @api-schema-flow/flow test:integration
pnpm test
pnpm test:integration
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add fixtures/flow packages/flow/tests examples/reservation/README.md
git commit -m "test(flow): add declared graph golden fixtures"
```

### Task 8: Documentation, Full Verification, and PR Readiness

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`
- Create: `docs/reports/m2b-declared-flow-graph-verification.md`
- Modify: `docs/superpowers/plans/2026-09-02-m2b-declared-flow-graph.md`

**Interfaces:**
- Documentation must distinguish implemented declared graph support from unimplemented inference, Web UI, export, and execution.

- [ ] **Step 1: Update implementation status**

Document:

- shared graph contracts;
- OpenAPI Link projection;
- Arazzo control/dependency/data projection;
- deterministic deduplication;
- current limitations.

Do not describe M2-C inference or M3 Web UI as implemented.

- [ ] **Step 2: Update Roadmap status without changing future scope**

Mark M2-A and M2-B capabilities as implemented while leaving inference, decisions, export, and Web UI pending.

- [ ] **Step 3: Run the complete verification sequence**

```bash
pnpm install --frozen-lockfile
pnpm workspace:check
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
pnpm boundaries:check
pnpm ci:verify
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Record exact evidence**

`docs/reports/m2b-declared-flow-graph-verification.md` records:

- branch head SHA;
- toolchain versions;
- package/test counts;
- golden graph counts;
- full command results;
- known limitations;
- GitHub Actions run URL after the remote run completes.

- [ ] **Step 5: Mark plan checkboxes complete**

Update only after fresh verification evidence exists.

- [ ] **Step 6: Commit documentation and evidence**

```bash
git add README.md README.zh-TW.md CHANGELOG.md ROADMAP.md docs/reports docs/superpowers/plans/2026-09-02-m2b-declared-flow-graph.md
git commit -m "docs: record M2-B declared graph implementation"
```

- [ ] **Step 7: Push and wait for GitHub Actions**

The Draft PR remains open. Do not mark the slice complete until the exact remote branch head has a successful CI run.

- [ ] **Step 8: Update the Draft PR body with evidence**

Include delivered scope, architecture, counts, successful run URL, explicit limitations, and review focus.
