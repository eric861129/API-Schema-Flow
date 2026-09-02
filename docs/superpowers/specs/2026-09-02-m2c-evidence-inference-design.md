# M2-C Evidence-based Inference Core Design

> Status: Approved implementation baseline  
> Date: 2026-09-02  
> Scope: Deterministic candidate inference only; no review UI, execution, mock runtime, or export

## 1. Purpose

M2-C turns normalized OpenAPI operations and the M2-B declared graph into conservative, explainable dependency candidates.

The engine does not reconstruct business truth. It proposes reviewable mappings backed by stable evidence and source pointers.

Core guarantees:

- Deterministic output for the same semantic input, configuration, and rule-set version.
- Every candidate identifies an exact source value and exact target value.
- Every score is decomposable into evidence and penalties.
- Inferred candidates are never accepted automatically.
- Existing declared mappings are not emitted again as candidates.
- Generic names such as `id` cannot independently reach Medium or High confidence.
- Clearly incompatible or unsafe mappings are blocked before scoring.
- The core is parser-independent, UI-independent, and execution-independent.

## 2. Slice boundaries

### Included

- Serializable inference contracts.
- Operation, response-field, request-field, parameter, and security-target indexing.
- Bounded candidate-pair generation.
- Hard constraints and blocker reporting.
- Deterministic evidence rules.
- Score aggregation and confidence bands.
- Stable candidate IDs and semantic fingerprints.
- Declared-edge suppression.
- Deterministic ranking and Top-K limits.
- Benchmark fixtures and metrics.
- CLI `schema-flow infer <openapi-source> [--json]`.
- Debug statistics without payload or secret leakage.

### Excluded

- Accept, reject, or edit decisions.
- Decision persistence and invalidation.
- Arazzo generation or export.
- React, React Flow, ELK, or any Web UI.
- Workflow execution or Runtime Expression evaluation.
- Stateful Mock or transport adapters.
- LLM-based semantic suggestions.
- HAR, OpenTelemetry, or observed edges.
- JSONPath, arbitrary scripts, or user-defined coercion.

## 3. Architecture

A new package owns inference behavior:

```text
@api-schema-flow/inference
├─ depends on @api-schema-flow/domain
├─ depends on @api-schema-flow/diagnostics
└─ does not depend on openapi, arazzo, flow, React, Fastify, or MSW
```

The engine consumes project-owned normalized contracts only. The CLI remains the composition layer that obtains an OpenAPI document and passes its operations plus an M2-B declared graph to the engine.

```text
OpenAPI Parser / Normalizer
          │
          ▼
NormalizedApiDocument
          │
          ├──────────────┐
          ▼              ▼
Declared Flow Graph   Inference Indexes
          │              │
          └──────┬───────┘
                 ▼
       Candidate Generation
                 ▼
         Hard Constraints
                 ▼
          Evidence Rules
                 ▼
       Score + Confidence
                 ▼
      Stable Candidate Report
```

## 4. Public contracts

Inference contracts live in `@api-schema-flow/domain` because future CLI, Web UI, review decisions, and exports must share the same serialized vocabulary.

```ts
export type InferenceConfidenceBand = 'high' | 'medium' | 'low' | 'hidden'

export interface InferenceEvidence {
  readonly ruleId: string
  readonly kind: 'positive' | 'penalty'
  readonly weight: number
  readonly summary: string
  readonly sourcePointers: readonly SourcePointer[]
  readonly details: Readonly<Record<string, unknown>>
}

export interface InferenceBlocker {
  readonly ruleId: string
  readonly summary: string
  readonly sourcePointers: readonly SourcePointer[]
  readonly details: Readonly<Record<string, unknown>>
}

export interface InferenceCandidate {
  readonly id: string
  readonly fingerprint: string
  readonly ruleSetVersion: string
  readonly sourceOperationKey: string
  readonly targetOperationKey: string
  readonly source: FlowValueSelector
  readonly target: FlowValueTarget
  readonly score: number
  readonly confidence: number
  readonly band: InferenceConfidenceBand
  readonly evidence: readonly InferenceEvidence[]
  readonly blockers: readonly InferenceBlocker[]
  readonly status: 'candidate'
  readonly provenance: 'inferred'
}
```

The runtime report is:

```ts
export interface InferenceReport {
  readonly schemaVersion: '1.0'
  readonly ruleSetVersion: string
  readonly candidates: readonly InferenceCandidate[]
  readonly diagnostics: readonly Diagnostic[]
  readonly statistics: InferenceStatistics
}
```

All public values must be JSON-serializable and must not contain parser, RegExp, Map, Set, class instance, Date, function, or Error objects.

## 5. Engine input

```ts
export interface InferenceInput {
  readonly projectRevision: number
  readonly operations: readonly NormalizedOperation[]
  readonly declaredGraph?: FlowGraph
  readonly config?: Partial<InferenceConfig>
}
```

`projectRevision` is reported for caller correlation but does not participate in candidate identity. Candidate identity is semantic and therefore stable across no-op project revisions.

## 6. Configuration

Default configuration:

```ts
export interface InferenceConfig {
  readonly minimumVisibleConfidence: number
  readonly maximumCandidates: number
  readonly topKPerTarget: number
  readonly maximumPairEvaluations: number
  readonly includeHidden: boolean
}

export const DEFAULT_INFERENCE_CONFIG = {
  minimumVisibleConfidence: 0.6,
  maximumCandidates: 1000,
  topKPerTarget: 5,
  maximumPairEvaluations: 100000,
  includeHidden: false,
} as const
```

Invalid limits produce diagnostics and fall back to safe defaults. Configuration cannot disable hard security constraints.

## 7. Indexed values

### Source values

MVP source values are extracted from successful OpenAPI responses:

- Response body scalar fields.
- Response body object properties.
- Response body array item properties with an explicit selector requirement.
- Response headers.

Each indexed source stores:

```ts
interface IndexedSourceValue {
  operationKey: string
  selector: FlowValueSelector
  sourcePointer: SourcePointer
  rawName: string
  normalizedTokens: readonly string[]
  schemaTypes: readonly string[]
  format?: string
  resourceTokens: readonly string[]
  arrayDepth: number
  writeOnly: boolean
  secretShaped: boolean
}
```

Error responses are excluded by default. A response is treated as successful when its status is `2xx`, `3xx`, or `default` only when no explicit success response exists.

### Target values

MVP target values are:

- Required and optional path, query, header, cookie, and querystring parameters.
- Request-body scalar and object properties.
- Explicit Authorization/security targets derived from normalized security requirements.

Each target stores equivalent name, type, format, resource, source-pointer, array, read-only, and security metadata.

## 8. Schema traversal

The walker is defensive and bounded:

- Maximum schema depth: 32.
- Cycle detection by semantic source pointer/reference identity.
- Deterministic property order.
- `allOf` members are traversed and merged as evidence sources, not mutated.
- `oneOf` and `anyOf` contribute compatible alternatives but lower certainty.
- Arrays never imply `first` automatically.
- Objects and arrays cannot directly satisfy scalar path parameters.
- Missing type information is unknown, not automatically compatible.

M2-C uses only information already present in normalized schemas. It performs no source retrieval and no parser-specific dereferencing.

## 9. Name normalization

Name normalization performs:

1. Unicode NFKC normalization.
2. Case folding.
3. camelCase, PascalCase, snake_case, kebab-case, dotted-path, and whitespace tokenization.
4. Conservative removal of wrapper tokens: `data`, `result`, `payload`, `response`, `request`.
5. Conservative singularization for simple English plural suffixes.
6. Preservation of resource-qualified ID forms such as `reservationId`.

Examples:

```text
reservation_id  → [reservation, id]
reservationId   → [reservation, id]
Reservation-ID  → [reservation, id]
id              → [id]
```

The token `id` alone is always marked generic.

## 10. Candidate-space control

The engine must not compare every source field to every target field without bounds.

Indexes:

- Exact raw-name index.
- Normalized token-key index.
- Type and format index.
- Resource-token index.
- Security-target index.
- Lifecycle index by HTTP method and resource path.

A pair becomes plausible only if at least one strong entry condition holds:

- Exact or normalized name match.
- Resource-qualified ID match.
- Same non-generic format plus a name/resource signal.
- Explicit bearer/security target plus token-shaped source.
- Create-operation response to item-operation path parameter for the same resource.

The engine stops at `maximumPairEvaluations`, emits `ASF-INF-2001`, and returns deterministic partial results.

## 11. Hard constraints

Blocked pairs do not become candidates.

| Rule ID | Behavior |
|---|---|
| `INF-BLOCK-SAME-OPERATION` | Blocks mappings within the same operation in M2-C. |
| `INF-BLOCK-INCOMPATIBLE-TYPE` | Blocks clearly incompatible scalar/object/array mappings. |
| `INF-BLOCK-ARRAY-SELECTOR` | Blocks an array-derived source when no explicit selector exists. |
| `INF-BLOCK-WRITE-ONLY` | Blocks write-only response fields. |
| `INF-BLOCK-READ-ONLY` | Blocks read-only request targets. |
| `INF-BLOCK-SECRET-TARGET` | Blocks secret-shaped sources to non-security targets. |
| `INF-BLOCK-DECLARED` | Suppresses a semantic mapping already present in the declared graph. |
| `INF-BLOCK-IMMEDIATE-CYCLE` | Blocks an immediate reverse dependency that conflicts with a declared edge. |

Blocked-pair counts are included in debug statistics by rule, but sensitive values are not included.

## 12. Evidence rules

Initial deterministic rule catalog:

| Rule ID | Weight | Meaning |
|---|---:|---|
| `INF-NAME-EXACT` | +25 | Exact case-insensitive field/parameter name. |
| `INF-NAME-NORMALIZED` | +18 | Equal normalized token sequence. |
| `INF-RESOURCE-ID` | +25 | Resource-qualified ID maps to matching resource item target. |
| `INF-SCHEMA-TYPE` | +12 | Compatible schema type. |
| `INF-SCHEMA-FORMAT` | +10 | Equal non-empty format such as UUID or date-time. |
| `INF-RESOURCE-PATH` | +15 | Same normalized resource path. |
| `INF-LIFECYCLE-CREATE-READ` | +20 | POST collection response to GET item request. |
| `INF-LIFECYCLE-CREATE-UPDATE` | +15 | POST collection response to PUT/PATCH item request. |
| `INF-AUTH-BEARER` | +55 | Token-shaped response to explicit bearer/security target. |
| `INF-TAG-SAME` | +4 | Operations share a tag. |
| `INF-OPERATION-NAME` | +6 | Operation IDs share non-generic semantic tokens. |
| `INF-GENERIC-ID` | +3 | Only a generic `id` signal. |
| `INF-TYPE-COERCION` | -5 | Safe built-in string/number coercion would be required. |
| `INF-CROSS-RESOURCE` | -20 | Cross-resource mapping without stronger resource evidence. |
| `INF-CYCLE-RISK` | -25 | Candidate introduces a suspicious reverse dependency. |

Weights are versioned behavior. Any weight or scoring change increments `INFERENCE_RULE_SET_VERSION`.

## 13. Score and confidence

Raw score is the sum of evidence weights after blockers.

M2-C uses a deterministic piecewise mapping:

```text
score <= 0   → 0.00
score 1..59  → score / 100
score 60..99 → score / 100
score >= 100 → 0.99
```

Bands:

```text
0.90–1.00 → high
0.75–0.89 → medium
0.60–0.74 → low
< 0.60    → hidden
```

Confidence caps:

- Generic `id` without resource-qualified evidence: maximum `0.59`.
- Tag and operation-name evidence without a strong field signal: maximum `0.59`.
- Unknown type with only normalized-name evidence: maximum `0.74`.
- Array-derived values without a selector are blocked, not capped.

High confidence means strong deterministic evidence, not guaranteed business truth.

## 14. Stable identity

Candidate fingerprint input:

```text
ruleSetVersion
sourceOperationKey
targetOperationKey
canonical source selector
canonical target descriptor
```

Candidate ID:

```text
candidate:<lowercase-sha256>
```

The identity excludes:

- Score and confidence.
- Evidence ordering.
- Project revision.
- Timestamp.
- UI layout.
- Absolute temporary paths.
- Example or runtime values.

This lets later decision records survive harmless evidence-detail changes while still invalidating when the semantic source or target changes.

## 15. Declared-edge suppression

Before scoring, the engine builds semantic mapping keys from `declaredGraph.edges`.

A candidate is suppressed when source operation, target operation, source selector, and target mapping are equivalent to an accepted declared data edge.

Declared provenance is never changed. The inference engine can count corroborating evidence internally but does not duplicate it as a candidate.

## 16. Ranking

Candidates are ordered by:

1. Confidence descending.
2. Score descending.
3. Target operation key ascending.
4. Target canonical value ascending.
5. Source operation key ascending.
6. Source canonical value ascending.
7. Candidate ID ascending.

`topKPerTarget` is applied after deterministic ranking. `maximumCandidates` is then applied globally.

## 17. Diagnostics

New namespace:

```text
ASF-INF-1001  Invalid inference configuration
ASF-INF-1002  Invalid or incomplete normalized operation
ASF-INF-1003  Schema traversal limit reached
ASF-INF-1004  Candidate identity collision
ASF-INF-1005  Declared graph contains an invalid mapping
ASF-INF-2001  Candidate evaluation budget reached
ASF-INF-2002  Candidate output truncated
ASF-INF-9000  Rule execution failed safely
```

A rule failure must not fail the complete import. The rule is skipped, the diagnostic records the rule ID and source pointers, and other rules continue.

Diagnostics and debug data must pass existing redaction policy before CLI output.

## 18. CLI

Command:

```bash
schema-flow infer <openapi-source>
```

Options reuse the existing source policy flags and add:

```text
--json
--include-hidden
--minimum-confidence <0..1>
--max-candidates <positive integer>
--top-k <positive integer>
```

Human output includes:

- Operations indexed.
- Source and target values indexed.
- Pair evaluations.
- Candidates by confidence band.
- Top candidate summaries with score and evidence rule IDs.
- Diagnostics.

JSON output:

```json
{
  "schemaVersion": "1.0",
  "command": "infer",
  "source": "openapi.yaml",
  "valid": true,
  "ruleSetVersion": "1.0.0",
  "projectRevision": 0,
  "statistics": {},
  "candidates": [],
  "diagnostics": []
}
```

Exit codes remain:

```text
0  Inference completed without error diagnostics
1  Specification or inference error diagnostics
2  Usage, source, or policy error
3  Unexpected internal error
```

## 19. Benchmark dataset

Fixtures live under:

```text
fixtures/inference/
├─ exact-resource-id/
├─ aliased-resource-id/
├─ generic-id-negative/
├─ bearer-token/
├─ nested-resource/
├─ array-selector-negative/
├─ type-mismatch-negative/
├─ cross-resource-same-name/
├─ pagination-cursor/
├─ multiple-candidate-ids/
└─ declared-link-suppression/
```

Each case contains an OpenAPI document and `labels.json` with expected positive and negative semantic mappings.

Metrics:

- High-confidence precision.
- Medium-or-higher precision.
- Recall of labeled positives.
- False positives by rule.
- Candidate count.
- Pair evaluation count.
- Runtime.

M2-C exit gate:

```text
High-confidence precision >= 0.85
Generic-id negative high-confidence false positives = 0
Declared mappings emitted as candidates = 0
Deterministic report equality = true
```

The benchmark uses synthetic fixtures only and must not contain credentials or proprietary schemas.

## 20. Performance

Target on the existing CI runner:

- 500 operations.
- Candidate generation and scoring under 5 seconds.
- Pair evaluations remain within configured budget.
- No unbounded cross-product allocation.
- Deterministic truncation when budgets are reached.

Performance is a regression gate, not a microbenchmark promise.

## 21. Security and privacy

- No actual response, request, token, password, cookie, or API-key values are required.
- Evidence stores schema/source metadata only.
- Secret-shaped field names are permitted as metadata but literal examples and defaults are not copied into candidates.
- Diagnostics and CLI reports are redacted.
- No network access exists in the inference package.
- No dynamic code, regex from user input, plugin execution, or LLM call occurs.

## 22. Testing strategy

### Unit tests

- Name normalization.
- Schema traversal and cycle/depth protection.
- Field indexing.
- Candidate pair bounds.
- Every evidence rule.
- Every blocker.
- Confidence caps and bands.
- Stable candidate identity.
- Declared-edge suppression.
- Ranking and Top-K behavior.
- Secret-value absence.

### Integration tests

- Canonical Reservation inference.
- OpenAPI Link suppression.
- Deterministic output across repeated runs.
- CLI human and JSON reports.
- Existing OpenAPI, Arazzo, Flow, and CLI regression suites.

### Benchmark tests

- Labeled fixture metrics.
- 500-operation runtime and pair budget.

## 23. Acceptance criteria

1. Same semantic input, config, and rule-set version produces byte-equivalent candidate JSON.
2. Every emitted candidate has exact source and target descriptors plus at least one positive evidence item.
3. Every evidence item has a stable rule ID, numeric weight, explanation, and source pointers where available.
4. Generic `id` alone never produces Medium or High confidence.
5. Type-incompatible pairs never become candidates.
6. Array-derived values without an explicit selector never become candidates.
7. Secret-shaped values never map to non-security targets.
8. A semantic mapping already present in the declared graph is not emitted again.
9. No candidate is marked accepted.
10. High-confidence benchmark precision is at least 85%.
11. Candidate pair and output limits are deterministic and diagnostic-backed.
12. The 500-operation performance gate completes under five seconds on CI.
13. `schema-flow infer` provides stable human, JSON, diagnostic, and exit-code behavior.
14. `@api-schema-flow/inference` has no parser, UI, server, mock, execution, or network dependency.
15. All existing tests and package-boundary checks continue to pass.

## 24. Follow-up boundary

M2-D will consume these candidates to add accept/reject/edit decisions, decision invalidation, accepted inferred edges, and canonical Arazzo export. M2-C intentionally does not persist or apply user decisions.