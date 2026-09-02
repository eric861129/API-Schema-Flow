# M2-C Evidence-Based Inference Core Design

> Status: approved implementation baseline  
> Date: 2026-09-02  
> Branch: `feat/m2c-inference-core`  
> Scope: deterministic inference candidates only

## 1. Purpose

M2-C adds the first inference layer above the normalized OpenAPI model and the M2-B declared operation graph. It proposes likely response-to-request data mappings while remaining conservative, explainable, deterministic, bounded, and reviewable.

The engine is not a business-process oracle. It must never convert a heuristic result directly into an accepted graph edge.

## 2. Outcome

Given normalized OpenAPI sources and the declared operation topology, M2-C produces a stable report containing:

- inferred mapping candidates;
- source and target operation identities;
- structural selectors and targets;
- a rule-by-rule evidence breakdown;
- blockers that prevented unsafe suggestions;
- raw score, confidence, and confidence band;
- deterministic candidate identity;
- bounded runtime and candidate-count metrics;
- redacted diagnostics.

Every emitted result has:

```ts
provenance: 'inferred'
status: 'candidate'
```

M2-C does not mutate the declared graph and does not persist user decisions.

## 3. Non-goals

M2-C does not implement:

- candidate acceptance, rejection, editing, or decision persistence;
- Arazzo generation or export;
- React, React Flow, ELK, or any visual workspace;
- LLM-based semantic matching;
- workflow execution, HTTP transport, Mock Runtime, or Live Trace;
- automatic array-item selection, JSONPath, coercion scripts, or arbitrary code;
- observed edges from HAR, OpenTelemetry, or proxy traffic;
- cross-project cloud collaboration.

## 4. Architecture

A new package owns inference behavior:

```text
@api-schema-flow/domain
        ▲
        │ serializable candidate/evidence contracts
        │
@api-schema-flow/flow
        ▲
        │ declared operation graph and canonical identities
        │
@api-schema-flow/inference
        │
        ├─ field indexing
        ├─ candidate pair generation
        ├─ hard constraints
        ├─ evidence rules
        ├─ score/confidence aggregation
        ├─ declared-edge suppression
        └─ benchmark/report generation
```

The package may depend on:

- `@api-schema-flow/domain`;
- `@api-schema-flow/diagnostics`;
- `@api-schema-flow/flow`.

It must not depend on OpenAPI parser implementations, Arazzo parsing, UI frameworks, network/server frameworks, Mock Runtime, or execution packages. Its inputs are normalized project-owned contracts.

## 5. Public contracts

Serializable contracts live in `@api-schema-flow/domain` because the future M2-D decision layer and M3 workspace need to consume them without depending on inference implementation details.

### 5.1 Evidence

```ts
interface InferenceEvidence {
  readonly ruleId: string
  readonly kind: 'positive' | 'penalty' | 'blocker'
  readonly weight: number
  readonly message: string
  readonly sourcePointers: readonly SourcePointer[]
}
```

Evidence messages explain the rule result but never include runtime values, examples, credentials, or full payloads.

### 5.2 Candidate

```ts
interface InferenceCandidate {
  readonly schemaVersion: '1.0'
  readonly id: string
  readonly fingerprint: string
  readonly ruleSetVersion: string
  readonly sourceOperationNodeId: string
  readonly targetOperationNodeId: string
  readonly sourceOperationKey: string
  readonly targetOperationKey: string
  readonly mapping: FlowDataMapping
  readonly score: number
  readonly confidence: number
  readonly band: 'high' | 'medium' | 'low'
  readonly evidence: readonly InferenceEvidence[]
  readonly blockers: readonly InferenceEvidence[]
  readonly provenance: 'inferred'
  readonly status: 'candidate'
}
```

Blocked pairs are counted in debug metrics but are not emitted as candidates. Candidates below the configured minimum confidence are also omitted from the normal report.

### 5.3 Report

```ts
interface InferenceReport {
  readonly schemaVersion: '1.0'
  readonly ruleSetVersion: string
  readonly candidates: readonly InferenceCandidate[]
  readonly metrics: InferenceMetrics
  readonly diagnostics: readonly Diagnostic[]
}
```

Metrics include indexed source count, indexed target count, generated pair count, blocked pair count, suppressed-declared count, emitted candidate count, confidence-band counts, truncation state, and elapsed milliseconds.

## 6. Input

```ts
interface InferFlowCandidatesInput {
  readonly openApiSources: readonly FlowOpenApiSource[]
  readonly declaredOperationGraph: FlowGraph
  readonly config?: Partial<InferenceConfig>
}
```

The operation graph must be `kind: 'operation-topology'`. M2-C accepts only operation-level candidate mappings.

## 7. Field indexing

The engine first converts normalized operations into structural field records.

### 7.1 Source fields

Source fields come from successful response schemas:

- explicit `2xx` responses;
- `default` only when no explicit `2xx` response exists;
- response body object properties;
- response headers when represented by a future normalized header contract.

Each source record contains:

- operation and endpoint-node identity;
- `FlowValueSelector`;
- field name and normalized tokens;
- schema types and format;
- resource key;
- source pointer;
- read/write flags;
- array depth;
- success status code.

Object properties are traversed recursively with a configurable maximum depth. `allOf` members are traversed and merged by structural pointer. `anyOf` and `oneOf` fields are indexed but marked variant, reducing confidence. Cycles are terminated by source-pointer/ref identity.

Array item fields are indexed for diagnostics and benchmark coverage, but array depth greater than zero blocks direct scalar mappings because M2-C has no selector policy.

### 7.2 Target fields

Target fields come from:

- path, query, querystring, header, and cookie parameters;
- request-body object properties;
- virtual `Authorization` headers for operations whose security requirement references a bearer-like scheme name.

Each target record contains operation identity, `FlowValueTarget`, name/tokens, schema type/format, resource key, required/read/write flags, source pointer, and whether the target is security-sensitive.

## 8. Name normalization

Normalization is deterministic and locale-independent:

1. Unicode NFKC normalization;
2. camelCase and PascalCase boundary splitting;
3. snake_case, kebab-case, dotted, and whitespace splitting;
4. lower-case folding;
5. removal of empty tokens;
6. conservative singularization of a trailing plural `s` for resource comparison;
7. preservation of the original name and source pointer.

Examples:

```text
reservationId  -> [reservation, id]
reservation_id -> [reservation, id]
Reservation-ID -> [reservation, id]
id             -> [id]
```

Wrapper tokens such as `data`, `result`, and `payload` may be ignored for comparison only when they are path-container segments. They are never removed from source pointers.

## 9. Candidate-space control

The engine must not compare every response field with every request field without limits.

Indexes are built for:

- exact lower-cased name;
- normalized token signature;
- type and format;
- resource key;
- resource-ID alias;
- security target;
- operation lifecycle.

Candidate pairs are generated from index intersections and explicit rule-specific generators. Configuration limits:

```ts
interface InferenceConfig {
  readonly minimumConfidence: number // default 0.60
  readonly topKPerTarget: number // default 5
  readonly maxCandidates: number // default 5_000
  readonly maxPairs: number // default 50_000
  readonly maxSchemaDepth: number // default 12
  readonly maxElapsedMs: number // default 5_000
  readonly includeLowConfidence: boolean // default true
}
```

When a limit is reached, output remains deterministic, a truncation metric is set, and a warning diagnostic is emitted.

## 10. Hard constraints

A pair is blocked before scoring when any of these conditions applies:

- source and target are on the same operation without an explicit lifecycle reason;
- source schema is `writeOnly`;
- target request schema is `readOnly`;
- source and target primitive types are explicitly incompatible;
- an array/object source would feed a scalar/path target without a selector;
- a password, secret, client secret, refresh token, cookie value, or API key is suggested to a non-security target;
- an identical structural mapping is already present in a declared data edge between the same operation nodes;
- the candidate would create an immediate cycle in the declared control/dependency topology;
- either endpoint node cannot be found in the declared operation graph.

A blocked pair never becomes a candidate, regardless of positive evidence.

## 11. Rule catalog

The first rule set is versioned as `m2c-v1`.

| Rule ID | Effect | Weight |
|---|---|---:|
| `INF-NAME-EXACT` | original field names equal, header comparison case-insensitive | +25 |
| `INF-NAME-NORMALIZED` | normalized token signatures equal | +18 |
| `INF-RESOURCE-ID` | resource-qualified ID maps to matching item parameter | +25 |
| `INF-SCHEMA-TYPE` | compatible primitive type intersection | +12 |
| `INF-SCHEMA-FORMAT` | equal non-empty format | +10 |
| `INF-RESOURCE-PATH` | source and target share resource key | +15 |
| `INF-LIFECYCLE-CREATE-READ` | POST collection response maps to GET item request | +20 |
| `INF-AUTH-BEARER` | token-like response feeds bearer-secured Authorization target | +65 |
| `INF-TAG-SAME` | operations share at least one tag | +4 |
| `INF-OPERATION-NAME` | operation IDs share a meaningful non-generic token | +6 |
| `INF-GENERIC-ID` | only generic `id` name evidence exists | +3 and confidence cap |
| `INF-VARIANT-SCHEMA` | source is under `anyOf` or `oneOf` | -10 |
| `INF-CROSS-RESOURCE` | different resource keys without a resource-ID relation | -20 |
| `INF-CYCLE-RISK` | topology would create a cycle | blocker |
| `INF-ARRAY-SELECTOR` | array item requires an explicit selector | blocker |
| `INF-INCOMPATIBLE` | explicit type incompatibility | blocker |
| `INF-DECLARED-DUPLICATE` | same mapping already declared | blocker/suppression |
| `INF-SECRET-TARGET` | secret-shaped field targets non-security input | blocker |

Weights are implementation defaults, not a claim of statistical truth. The public benchmark calibrates release behavior.

## 12. Scoring and confidence

Score is the sum of positive and penalty evidence. Confidence uses a deterministic piecewise mapping:

```text
score >= 80 -> 0.95
score >= 65 -> 0.88
score >= 50 -> 0.78
score >= 35 -> 0.68
otherwise   -> min(0.59, max(0, score / 100))
```

Bands:

- `high`: 0.90–1.00;
- `medium`: 0.75–0.89;
- `low`: 0.60–0.74.

Special caps:

- evidence consisting only of generic `id`, tag, operation-name, or type rules cannot exceed 0.59;
- generic `id` without a matching resource/lifecycle relation cannot be emitted;
- bearer auth requires both a token-like source name and a bearer-like target security scheme;
- penalties may lower a pair below the reporting threshold.

Confidence means rule confidence, not verified business intent.

## 13. Deterministic identity and ordering

Candidate fingerprint input contains:

- rule-set version;
- source operation node ID;
- target operation node ID;
- canonical source selector;
- canonical target;
- source and target schema fingerprints.

Candidate ID is derived from the fingerprint. It excludes score, evidence order, timestamps, elapsed time, examples, runtime values, and UI state.

Output ordering is:

1. descending confidence;
2. descending score;
3. target operation node ID;
4. target mapping identity;
5. source operation node ID;
6. candidate ID.

Evidence and source pointers are deduplicated and sorted.

## 14. Declared-edge suppression

Before emitting a candidate, the engine canonicalizes every declared data mapping by source selector, target, source node, and target node.

If the inferred pair is identical:

- no duplicate candidate is emitted;
- `suppressedDeclaredCount` is incremented;
- debug evidence records `INF-DECLARED-DUPLICATE` without copying runtime values.

Declared edges are never overwritten or rescored.

## 15. Diagnostics

M2-C introduces stable `ASF-INF-*` codes:

```text
ASF-INF-1001  Invalid inference input graph
ASF-INF-1002  Endpoint operation binding missing
ASF-INF-1003  Schema traversal limit reached
ASF-INF-1004  Candidate pair limit reached
ASF-INF-1005  Candidate output limit reached
ASF-INF-1006  Inference time budget reached
ASF-INF-1007  Rule evaluation failed safely
ASF-INF-1008  Benchmark contract invalid
```

Individual rule failures are isolated, reported, and do not crash the entire run. Diagnostics and report data must remain secret-safe.

## 16. Benchmark

A committed synthetic benchmark manifest covers at least:

- exact and normalized ID mapping;
- resource-qualified ID mapping;
- generic `id` false positive;
- login token to bearer authorization;
- nested resource IDs;
- array selector requirement;
- incompatible types;
- cross-service equal names;
- pagination cursor;
- multiple candidate IDs;
- declared mapping suppression.

Metrics:

- high-confidence precision;
- medium-confidence precision;
- recall over labeled positives;
- false positives by rule;
- emitted candidate count;
- blocked and suppressed counts;
- elapsed time.

M2-C release gate:

```text
High-confidence precision >= 0.85
Generic-id negative cases produce no high candidate
Declared mappings are not duplicated
500-operation synthetic run completes within 5,000 ms in CI
```

The benchmark is synthetic and must not contain production schemas or secrets.

## 17. CLI

M2-C adds:

```bash
schema-flow infer <openapi-file-or-url> [options]
```

Supported options reuse source-retrieval policy flags and add:

```text
--json
--minimum-confidence <0..1>
--top-k <n>
--max-candidates <n>
--include-low
```

The command:

1. loads and normalizes one OpenAPI entry graph;
2. builds the declared operation graph from OpenAPI Links;
3. runs M2-C inference;
4. prints candidates and evidence;
5. returns exit code `0` when processing succeeds, even if there are no candidates;
6. returns existing input/specification/internal exit codes for failures.

Human output shows summary counts and the top candidates. JSON output is stable and machine-readable. It never accepts candidates or writes project state.

## 18. Testing

Required tests:

- contract serialization tests;
- name normalization tests;
- schema traversal and recursion-limit tests;
- source/target index tests;
- each evidence rule in isolation;
- each hard blocker in isolation;
- declared-edge suppression;
- candidate ID and ordering determinism;
- generic-ID confidence cap;
- benchmark precision and recall;
- 500-operation performance gate;
- CLI human and JSON reports;
- package boundary and secret scans;
- all existing OpenAPI, Arazzo, Flow, and CLI regression suites.

Tests follow RED → GREEN → REFACTOR. Benchmark labels are reviewed independently of generated candidates.

## 19. Acceptance criteria

M2-C is complete when:

1. identical inputs/config/rule version produce identical candidate IDs, scores, evidence, and order;
2. every emitted candidate has source/target pointers and a non-empty evidence list;
3. every emitted candidate remains `inferred + candidate`;
4. no candidate mutates or replaces a declared edge;
5. declared-equivalent mappings are suppressed;
6. generic `id` alone never reaches high confidence;
7. array-item mappings are blocked until a selector is explicit;
8. explicit type mismatches are blocked;
9. bearer-token suggestions require both source and target security evidence;
10. high-confidence benchmark precision is at least 85%;
11. 500-operation inference completes under the CI budget;
12. CLI output contains no example, password, token, cookie, or API-key value;
13. the inference package has no UI, network, mock, or execution dependency;
14. the exact final branch head passes the complete repository CI.

## 20. Follow-up boundary

M2-D will consume these candidates to implement accept/reject/edit decisions, decision invalidation, accepted inferred edges, and canonical Arazzo export. M3 will render the same contracts without changing inference semantics.
