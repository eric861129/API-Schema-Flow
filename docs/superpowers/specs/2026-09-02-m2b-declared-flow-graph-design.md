# M2-B Declared Flow Graph Design

> Status: Approved design baseline  
> Date: 2026-09-02  
> Scope: API Schema Flow M2-B

## 1. Goal

M2-B introduces the first shared, parser-independent flow graph used by future inference, Web UI, export, and execution slices.

The slice converts only standard-declared facts into deterministic graph objects:

- OpenAPI Link Objects become declared operation data edges.
- Arazzo step order becomes workflow control edges.
- Arazzo `dependsOn` becomes workflow dependency edges.
- Arazzo step-output Runtime Expressions become workflow and operation data edges.
- Equivalent declared mappings from different standards are merged while retaining every source reference.

M2-B does not infer business intent. Every produced edge has:

```ts
provenance: 'declared'
status: 'accepted'
```

## 2. Architectural Classification

This is an architectural slice because it adds a shared graph contract consumed by several future subsystems. The design therefore separates stable data contracts from format-specific projection logic.

```text
OpenAPI normalized model ─┐
                          ├─> @api-schema-flow/flow ─> FlowProjection
Arazzo normalized model ──┘
```

The existing parser packages remain independent:

```text
@api-schema-flow/openapi  -X->  @api-schema-flow/arazzo
@api-schema-flow/arazzo   -X->  @api-schema-flow/openapi
```

Only the new composition package may depend on both.

## 3. Product Boundary

### Included

- Shared operation-topology and workflow-instance graph contracts.
- Stable node, edge, mapping, and graph identities.
- OpenAPI Link projection.
- Arazzo control, dependency, and data-edge projection.
- Arazzo operation binding through the existing abstract operation catalog.
- Deterministic merge and ordering.
- Source provenance and source pointers.
- Golden graph fixtures.
- Architecture and regression tests.

### Excluded

- Name-, schema-, lifecycle-, auth-, or LLM-based inference.
- Confidence scores and candidate ranking.
- Accept, reject, edit, or decision persistence.
- Arazzo export.
- React, React Flow, ELK, or any Web UI.
- Workflow execution, expression evaluation, transports, mock runtime, or live trace.
- Observed edges from HAR, OpenTelemetry, or proxy traffic.

## 4. Packages and Responsibilities

### `@api-schema-flow/domain`

Owns serializable graph vocabulary only:

```text
flow-node.ts
flow-value.ts
flow-edge.ts
flow-graph.ts
```

It must not import OpenAPI, Arazzo, React, Node HTTP libraries, or parser-specific types.

### `@api-schema-flow/flow`

Owns graph construction and standard projection:

```text
canonical.ts
graph-assembler.ts
openapi-link-projector.ts
arazzo-value-projector.ts
arazzo-workflow-projector.ts
build-declared-flow-graphs.ts
index.ts
```

It may import public APIs from:

- `@api-schema-flow/domain`
- `@api-schema-flow/diagnostics`
- `@api-schema-flow/openapi`
- `@api-schema-flow/arazzo`

It must not import React, Fastify, MSW, ELK, or package-internal paths.

## 5. Public Input Contract

```ts
export interface FlowOpenApiSource {
  readonly sourceId: string
  readonly sourceName?: string
  readonly document: NormalizedApiDocument
}

export interface FlowArazzoSource {
  readonly sourceId: string
  readonly retrievalUri: string
  readonly document: NormalizedArazzoDocument
}

export interface BuildDeclaredFlowGraphsInput {
  readonly openApiSources: readonly FlowOpenApiSource[]
  readonly arazzoSources?: readonly FlowArazzoSource[]
}

export interface DeclaredFlowProjection {
  readonly operationGraph: FlowGraph
  readonly workflowGraphs: readonly FlowGraph[]
  readonly diagnostics: readonly Diagnostic[]
}

export function buildDeclaredFlowGraphs(
  input: BuildDeclaredFlowGraphsInput,
): DeclaredFlowProjection
```

`sourceId` is a caller-owned stable project identity. Absolute temporary paths must not be used in persistent node IDs.

`sourceName` binds an OpenAPI document to an Arazzo Source Description name. An Arazzo operation is not guessed across unbound sources.

## 6. Graph Contract

```ts
export type FlowGraphKind = 'operation-topology' | 'workflow-instance'

export interface FlowGraph {
  readonly schemaVersion: '1.0'
  readonly id: string
  readonly kind: FlowGraphKind
  readonly title: string
  readonly sourceIds: readonly string[]
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
}
```

All arrays use deterministic ordering:

1. nodes by `id`;
2. edges by `id`;
3. mappings by `id`;
4. source references by standard, URI, then pointer;
5. workflow graphs by `id`.

## 7. Node Contract

```ts
export type FlowNode = EndpointFlowNode | WorkflowStepFlowNode

export interface EndpointFlowNode {
  readonly kind: 'endpoint'
  readonly id: string
  readonly sourceId: string
  readonly operationKey: string
  readonly method: HttpMethod
  readonly path: string
  readonly operationId?: string
  readonly summary?: string
  readonly source: SourcePointer
}

export interface WorkflowStepFlowNode {
  readonly kind: 'workflow-step'
  readonly id: string
  readonly sourceId: string
  readonly workflowId: string
  readonly stepId: string
  readonly operationKey?: string
  readonly operationId?: string
  readonly operationPath?: string
  readonly source: SourcePointer
}
```

A workflow step is an instance node, not an alias of an endpoint node. The same API operation may appear in multiple workflow steps and must remain distinguishable in traces and editing.

## 8. Value Selector and Target Contract

### Sources

```ts
export type FlowValueSelector =
  | { readonly kind: 'request-header'; readonly name: string }
  | { readonly kind: 'request-query'; readonly name: string }
  | { readonly kind: 'request-path'; readonly name: string }
  | { readonly kind: 'request-body'; readonly pointer: string }
  | { readonly kind: 'response-header'; readonly name: string }
  | { readonly kind: 'response-body'; readonly pointer: string }
  | { readonly kind: 'status-code' }
  | { readonly kind: 'workflow-input'; readonly name: string }
  | { readonly kind: 'literal'; readonly value: string | number | boolean | null }
```

### Targets

```ts
export type FlowValueTarget =
  | { readonly kind: 'path-parameter'; readonly name: string }
  | { readonly kind: 'query-parameter'; readonly name: string }
  | { readonly kind: 'querystring-parameter'; readonly name: string }
  | { readonly kind: 'header-parameter'; readonly name: string }
  | { readonly kind: 'cookie-parameter'; readonly name: string }
  | { readonly kind: 'request-body'; readonly pointer: string }
```

### Aliases and transforms

Arazzo step outputs are aliases for actual request/response selectors. The graph stores the underlying selector for deduplication and may retain the alias metadata:

```ts
export interface FlowValueAlias {
  readonly kind: 'step-output'
  readonly workflowId: string
  readonly stepId: string
  readonly outputName: string
}

export type FlowValueTransform = {
  readonly kind: 'template'
  readonly raw: string
}
```

A template such as:

```text
Bearer {$steps.login.outputs.token}
```

produces a mapping from the resolved source selector to a header target with a template transform. M2-B does not evaluate the template.

## 9. Data Mapping Contract

```ts
export interface FlowDataMapping {
  readonly id: string
  readonly source: FlowValueSelector
  readonly target: FlowValueTarget
  readonly aliases: readonly FlowValueAlias[]
  readonly transform?: FlowValueTransform
  readonly sourcePointers: readonly SourcePointer[]
}
```

Mappings are declarative descriptions only. They do not contain runtime values, credentials, response payloads, or evaluated secrets.

## 10. Edge Contract

```ts
export type FlowEdgeKind = 'control' | 'dependency' | 'data'
export type FlowEdgeProvenance = 'declared' | 'manual' | 'inferred' | 'observed'
export type FlowEdgeStatus = 'accepted' | 'candidate' | 'rejected'

export type SourceStandard = 'openapi-link' | 'arazzo'

export interface SourceStandardRef {
  readonly standard: SourceStandard
  readonly source: SourcePointer
}

export interface FlowEdge {
  readonly id: string
  readonly kind: FlowEdgeKind
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly provenance: FlowEdgeProvenance
  readonly status: FlowEdgeStatus
  readonly mappings: readonly FlowDataMapping[]
  readonly sourceStandardRefs: readonly SourceStandardRef[]
}
```

M2-B invariant:

```ts
edge.provenance === 'declared'
edge.status === 'accepted'
```

Control and dependency edges have an empty `mappings` array.

## 11. Stable Identity Rules

IDs are readable, deterministic canonical strings rather than environment-dependent hashes.

```text
Endpoint node:
endpoint:<sourceId>:<operationKey>

Workflow step node:
workflow-step:<arazzoSourceId>:<workflowId>:<stepId>

Operation graph:
graph:operation-topology:<sorted-sourceIds>

Workflow graph:
graph:workflow:<arazzoSourceId>:<workflowId>
```

Edge identity uses canonical JSON for:

```text
kind
sourceNodeId
targetNodeId
canonical mappings
```

Source-standard references are intentionally excluded from edge identity, allowing equivalent declarations from Arazzo and OpenAPI Link to merge into one edge.

Mapping identity uses canonical JSON for:

```text
source selector
target selector
transform
```

Aliases and source pointers are merged metadata and do not change mapping identity.

IDs must not contain:

- timestamps;
- absolute temporary paths;
- UI layout coordinates;
- execution results;
- secret values.

## 12. OpenAPI Link Projection

For each normalized response link:

1. identify the source endpoint node;
2. require `resolvedOperationKey`;
3. find exactly one target endpoint node within the same bound OpenAPI source set;
4. parse each link parameter expression;
5. resolve qualified targets such as `path.id` directly;
6. resolve unqualified targets such as `id` against the target operation parameters;
7. recursively inspect Link `requestBody` strings for runtime expressions;
8. create one data edge for each source-target operation pair;
9. merge equivalent mappings and provenance references.

### Parameter target resolution

Header names are compared case-insensitively. Other parameter names are compared exactly.

An unqualified target is valid only when exactly one target parameter matches. Missing or ambiguous targets produce diagnostics and no mapping.

### Supported Link source expressions

- `$request.header.<name>`
- `$request.query.<name>`
- `$request.path.<name>`
- `$request.body#/<pointer>`
- `$response.header.<name>`
- `$response.body#/<pointer>`
- `$statusCode`

Unsupported expressions produce a diagnostic and no mapping. M2-B does not guess.

## 13. Arazzo Workflow Projection

For each workflow:

1. create one workflow-step node per step;
2. resolve the step operation through `resolveArazzoOperations()` using catalogs built from matching `sourceName` values;
3. create control edges for adjacent step-array entries;
4. create dependency edges for each explicit `dependsOn` reference;
5. inspect step parameters and request-body payload values recursively;
6. for every step-output Runtime Expression, locate the referenced source step and output;
7. resolve that output to an underlying request/response selector when possible;
8. create a data edge between source and target step nodes;
9. project the same relationship onto the operation topology when both steps resolve to endpoints.

Implicit dependencies already diagnosed by M2-A are represented as data edges, not a second dependency edge. Explicit `dependsOn` remains a distinct dependency edge.

### Step output resolution

The following output expressions are projected:

- response body;
- response header;
- request body;
- request header;
- request query;
- request path;
- status code;
- workflow input.

Outputs containing unsupported or compound source semantics are preserved in Arazzo but not projected as data mappings. A diagnostic explains the omission.

### Target projection

A step parameter maps its `in` value as follows:

```text
path        -> path-parameter
query       -> query-parameter
querystring -> querystring-parameter
header      -> header-parameter
cookie      -> cookie-parameter
```

Request-body object traversal uses RFC 6901 JSON Pointer fragments. For example:

```yaml
payload:
  reservation:
    spaceId: $steps.listSpaces.outputs.spaceId
```

maps to:

```text
#/reservation/spaceId
```

## 14. Operation Catalog Construction

`@api-schema-flow/flow` builds one Arazzo catalog per `FlowOpenApiSource` with a `sourceName`:

```ts
{
  sourceName,
  sourceType: 'openapi',
  operations: document.operations.map(operation => ({
    key: operation.id,
    operationId: operation.operationId,
    operationPath: operation.source.pointer,
  }))
}
```

`operationPath` follows the normalized OpenAPI operation source pointer, such as:

```text
#/paths/~1reservations~1{id}/get
```

Arazzo sources that reference an unbound or ambiguous source do not create dangling graph nodes or edges.

## 15. Merge Rules

### Nodes

Nodes merge only when their IDs are identical and their semantic fields are equal. Conflicting duplicate IDs produce an error.

### Edges

Edges merge when edge identity is equal. Merge behavior:

- union and sort `sourceStandardRefs`;
- union mappings by mapping identity;
- union mapping aliases;
- union mapping source pointers;
- keep `declared + accepted` invariants.

### Conflicts

Two declarations with the same mapping target but incompatible source selectors are separate edges. A conflict diagnostic may be emitted when both declarations claim the same source/target nodes and target but disagree on the source.

M2-B never chooses one declaration as truth by confidence.

## 16. Diagnostics

Add the `ASF-FLW-*` namespace:

```text
ASF-FLW-1001  Duplicate or conflicting node identity
ASF-FLW-1002  Dangling or unresolved endpoint target
ASF-FLW-1003  Invalid or unsupported data mapping
ASF-FLW-1004  Missing Arazzo operation binding
ASF-FLW-1005  Ambiguous Arazzo operation binding
ASF-FLW-1006  Missing workflow step or output
ASF-FLW-1007  Conflicting declared mapping
ASF-FLW-1008  Unsupported graph projection
```

Diagnostics must:

- be deterministic;
- include the narrowest available source pointer;
- never include evaluated secret values or full payloads;
- not crash graph construction;
- prevent only the affected node, edge, or mapping from being emitted.

## 17. Security and Privacy

The graph stores structure, not traffic.

It must not contain:

- Authorization values;
- cookies;
- tokens;
- request or response payload instances;
- environment variables;
- credentials embedded in URLs;
- parser exception dumps.

Literal Link values are projected only when they are JSON primitives and are not secret-shaped targets. Secret-shaped literals are omitted with `ASF-FLW-1003`.

## 18. Determinism

For identical normalized inputs and stable source IDs, repeated builds must produce byte-equivalent canonical JSON after `JSON.stringify(projection, null, 2)`.

Determinism requirements include:

- stable sorting;
- no Map or Set leakage;
- no `undefined` values in serialized objects;
- no environment path in IDs;
- no current time;
- no random IDs;
- canonical JSON Pointer escaping.

## 19. Testing Strategy

### Unit tests

- graph identity and canonicalization;
- graph assembler duplicate handling;
- OpenAPI Link parameter target resolution;
- OpenAPI Link expression mapping;
- Arazzo step-node projection;
- adjacent control edges;
- explicit dependency edges;
- step-output data edges;
- request-body pointer traversal;
- operation topology projection;
- multi-standard deduplication;
- missing and ambiguous bindings;
- no candidate edges;
- no secret literals.

### Integration and golden tests

Create:

```text
fixtures/flow/declared/
├─ openapi-link/
│  ├─ openapi.yaml
│  └─ expected-operation-graph.json
└─ arazzo-reservation/
   └─ expected-projection.json
```

The canonical Reservation projection must contain:

- four endpoint nodes;
- four workflow-step nodes;
- three workflow control edges;
- three explicit dependency edges;
- five workflow data edges: token to three Authorization headers, `spaceId` to request body, and `reservationId` to path parameter;
- equivalent operation-topology data/control/dependency relationships;
- only declared, accepted edges.

### Architecture tests

- `domain` imports neither `openapi` nor `arazzo`;
- `openapi` imports no `arazzo`;
- `arazzo` imports no `openapi`;
- `flow` may import both public package roots;
- `flow` imports no React, ELK, Fastify, or MSW;
- public declaration files expose no parser-native types.

## 20. Acceptance Criteria

M2-B is complete when:

1. the Reservation OpenAPI source produces four endpoint nodes;
2. the Reservation Arazzo source produces four workflow-step nodes;
3. step order produces three control edges;
4. explicit `dependsOn` produces three dependency edges;
5. token, `spaceId`, and `reservationId` mappings produce the expected data edges;
6. OpenAPI Link fixtures produce declared operation data edges;
7. every emitted M2-B edge is `declared + accepted`;
8. no inferred candidate is emitted;
9. equivalent Arazzo and OpenAPI Link mappings merge and retain both standard references;
10. unresolved or ambiguous targets do not produce dangling edges;
11. repeated projection produces identical IDs, ordering, and JSON;
12. graph JSON contains no secret runtime values;
13. existing OpenAPI, Arazzo, CLI, source-loader, and package-boundary tests remain green;
14. the golden projection can be consumed without parser-specific objects by the future React workspace.

## 21. Follow-up Boundary

After M2-B, the next independent slice is M2-C Evidence-based Inference Core. It will consume the declared graph but may only emit:

```ts
provenance: 'inferred'
status: 'candidate'
```

M2-C must not change the declared-edge truth model established here.
