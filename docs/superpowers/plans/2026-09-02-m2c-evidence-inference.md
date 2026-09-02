# M2-C Evidence-based Inference Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, conservative, explainable dependency-candidate engine over normalized OpenAPI operations and M2-B declared graphs, plus benchmark fixtures and `schema-flow infer`.

**Architecture:** `@api-schema-flow/domain` owns JSON-serializable inference contracts. A new parser-independent `@api-schema-flow/inference` package owns indexing, bounded candidate generation, hard constraints, evidence scoring, confidence bands, stable identities, ranking, declared-edge suppression, and benchmark evaluation. The CLI composes OpenAPI ingestion, declared graph projection, and inference without coupling the inference package to parser or transport code.

**Tech Stack:** TypeScript 6, pnpm 11, Turborepo, Vitest 4, Node.js 24 built-in crypto, existing OpenAPI/domain/diagnostics/redaction packages.

**Spec:** `docs/superpowers/specs/2026-09-02-m2c-evidence-inference-design.md`

## Global Constraints

- Every inferred result remains `provenance: 'inferred'`, `status: 'candidate'`.
- No inferred candidate may become an accepted graph edge in M2-C.
- Generic `id` without resource evidence has confidence capped below `0.60`.
- Clearly incompatible type, unsafe secret target, same-operation, selectorless array, read-only request, write-only response, and declared-equivalent mappings are blocked.
- Same semantic input, config, and `INFERENCE_RULE_SET_VERSION` must produce byte-equivalent sorted JSON.
- Candidate identity excludes project revision, score, confidence, evidence ordering, UI state, time, temporary path, and literal example values.
- `@api-schema-flow/inference` must not depend on OpenAPI parser, Arazzo parser, Flow composition, React, React Flow, ELK, Fastify, MSW, mock runtime, execution runtime, or network code.
- High-confidence benchmark precision must be at least `0.85`.
- 500-operation inference must complete under `5000 ms` on CI and respect pair/output budgets.
- Diagnostics and CLI output must use existing redaction policy.

---

### Task 1: Add serializable inference contracts to Domain

**Files:**
- Create: `packages/domain/src/inference.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/tests/unit/inference-contract.test.ts`

**Interfaces:**
- Consumes: `FlowGraph`, `FlowValueSelector`, `FlowValueTarget`, and `SourcePointer` from Domain.
- Produces: `InferenceConfidenceBand`, `InferenceEvidence`, `InferenceBlocker`, `InferenceCandidate`, `InferenceStatistics`, `InferenceReport`, `InferenceConfig`, `InferenceInput`, `DEFAULT_INFERENCE_CONFIG`, `INFERENCE_REPORT_SCHEMA_VERSION`, and `INFERENCE_RULE_SET_VERSION`.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_INFERENCE_CONFIG,
  INFERENCE_REPORT_SCHEMA_VERSION,
  INFERENCE_RULE_SET_VERSION,
  type InferenceCandidate,
} from '../../src/index.js'

describe('inference domain contracts', () => {
  test('exposes versioned safe defaults', () => {
    expect(INFERENCE_REPORT_SCHEMA_VERSION).toBe('1.0')
    expect(INFERENCE_RULE_SET_VERSION).toBe('1.0.0')
    expect(DEFAULT_INFERENCE_CONFIG).toEqual({
      minimumVisibleConfidence: 0.6,
      maximumCandidates: 1000,
      topKPerTarget: 5,
      maximumPairEvaluations: 100000,
      includeHidden: false,
    })
  })

  test('models candidates as inferred review-only values', () => {
    const candidate = {
      id: 'candidate:abc',
      fingerprint: 'abc',
      ruleSetVersion: INFERENCE_RULE_SET_VERSION,
      sourceOperationKey: 'operation:post:/reservations',
      targetOperationKey: 'operation:get:/reservations/{id}',
      source: { kind: 'response-body', pointer: '#/id' },
      target: { kind: 'path-parameter', name: 'id' },
      score: 100,
      confidence: 0.99,
      band: 'high',
      evidence: [],
      blockers: [],
      provenance: 'inferred',
      status: 'candidate',
    } satisfies InferenceCandidate

    expect(JSON.parse(JSON.stringify(candidate))).toEqual(candidate)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @api-schema-flow/domain test -- inference-contract.test.ts
```

Expected: failure because inference exports do not exist.

- [ ] **Step 3: Implement the domain contracts**

Create literal constants and readonly interfaces matching the Design Spec. Keep `details` values typed as `Readonly<Record<string, unknown>>`; do not add classes or Maps.

- [ ] **Step 4: Export the contracts and verify GREEN**

Run:

```bash
pnpm --filter @api-schema-flow/domain test -- inference-contract.test.ts
pnpm --filter @api-schema-flow/domain typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/inference.ts packages/domain/src/index.ts packages/domain/tests/unit/inference-contract.test.ts
git commit -m "feat(domain): add inference candidate contracts"
```

---

### Task 2: Create the Inference package and canonical identity utilities

**Files:**
- Create: `packages/inference/package.json`
- Create: `packages/inference/tsconfig.json`
- Create: `packages/inference/src/index.ts`
- Create: `packages/inference/src/canonical.ts`
- Create: `packages/inference/tests/unit/canonical.test.ts`
- Modify: `tooling/scripts/check-workspace.mjs`
- Modify: `tooling/scripts/check-boundaries.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: inference and flow value types from Domain.
- Produces: `canonicalInferenceValue(value)`, `createCandidateFingerprint(input)`, and `createCandidateId(fingerprint)`.

- [ ] **Step 1: Write failing stable-identity tests**

```ts
import { describe, expect, test } from 'vitest'
import {
  canonicalInferenceValue,
  createCandidateFingerprint,
  createCandidateId,
} from '../../src/index.js'

describe('inference identity', () => {
  test('canonicalizes nested keys deterministically', () => {
    expect(canonicalInferenceValue({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    )
  })

  test('excludes project revision and score from candidate identity', () => {
    const input = {
      ruleSetVersion: '1.0.0',
      sourceOperationKey: 'operation:post:/reservations',
      targetOperationKey: 'operation:get:/reservations/{id}',
      source: { kind: 'response-body', pointer: '#/id' } as const,
      target: { kind: 'path-parameter', name: 'id' } as const,
    }
    const fingerprint = createCandidateFingerprint(input)
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(createCandidateId(fingerprint)).toBe(`candidate:${fingerprint}`)
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @api-schema-flow/inference test -- canonical.test.ts
```

Expected: package or functions missing.

- [ ] **Step 3: Add package skeleton and minimal identity implementation**

Use `node:crypto` SHA-256. Canonicalization sorts object keys recursively, preserves array order, and serializes only JSON-safe values.

- [ ] **Step 4: Update workspace and boundary checks**

`check-workspace.mjs` must require `inference`. `check-boundaries.mjs` must reject imports from inference to `openapi`, `arazzo`, `flow`, React, server, mock, execution, or network packages.

- [ ] **Step 5: Update lockfile and verify GREEN**

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @api-schema-flow/inference test -- canonical.test.ts
pnpm --filter @api-schema-flow/inference build
pnpm boundaries:check
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/inference tooling/scripts/check-workspace.mjs tooling/scripts/check-boundaries.mjs pnpm-lock.yaml
git commit -m "feat(inference): initialize deterministic inference package"
```

---

### Task 3: Implement name, path, type, format, and secret normalization

**Files:**
- Create: `packages/inference/src/normalization.ts`
- Create: `packages/inference/src/type-compatibility.ts`
- Create: `packages/inference/tests/unit/normalization.test.ts`
- Create: `packages/inference/tests/unit/type-compatibility.test.ts`
- Modify: `packages/inference/src/index.ts`

**Interfaces:**
- Produces: `normalizeName(value)`, `normalizeResourcePath(path)`, `isGenericId(tokens)`, `isTokenShapedName(tokens)`, `isSecretShapedName(tokens)`, `schemaTypeSet(schema)`, and `compareTypes(source, target)`.

- [ ] **Step 1: Write failing normalization tests**

Cover:

```text
reservation_id → reservation,id
reservationId  → reservation,id
Reservation-ID → reservation,id
data.result.reservationId → reservation,id
id → generic
accessToken → token-shaped and secret-shaped
```

Also cover `/users/{userId}/orders/{orderId}` resource tokenization without treating parameter names as resources.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @api-schema-flow/inference test -- normalization.test.ts
```

- [ ] **Step 3: Implement conservative normalization**

Use NFKC, camel-case boundary splitting, punctuation splitting, wrapper-token removal, and conservative plural normalization. Never collapse all IDs to one resource.

- [ ] **Step 4: Write failing type-compatibility tests**

Required cases:

```text
string → string = compatible
integer → number = compatible
integer → string = coercible
object → string = incompatible
array → path parameter = incompatible
unknown → string = unknown
same UUID format = compatible with format evidence
UUID → date-time = incompatible format evidence
```

- [ ] **Step 5: Implement type comparison and verify GREEN**

Run:

```bash
pnpm --filter @api-schema-flow/inference test -- normalization.test.ts type-compatibility.test.ts
pnpm --filter @api-schema-flow/inference typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/inference/src packages/inference/tests/unit
git commit -m "feat(inference): normalize names resources and schema types"
```

---

### Task 4: Build bounded operation and field indexes

**Files:**
- Create: `packages/inference/src/schema-walker.ts`
- Create: `packages/inference/src/indexer.ts`
- Create: `packages/inference/src/internal-types.ts`
- Create: `packages/inference/tests/unit/schema-walker.test.ts`
- Create: `packages/inference/tests/unit/indexer.test.ts`
- Modify: `packages/inference/src/index.ts`

**Interfaces:**
- Produces: internal `IndexedSourceValue`, `IndexedTargetValue`, `InferenceIndexes`, and public `buildInferenceIndexes(operations)`.
- Inputs are `readonly NormalizedOperation[]` only.

- [ ] **Step 1: Write failing schema-walker tests**

Test deterministic traversal of object properties, `allOf`, arrays, read/write metadata, source pointers, and depth/cycle protection. Assert that array item fields retain `arrayDepth > 0` rather than receiving an implicit selector.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @api-schema-flow/inference test -- schema-walker.test.ts
```

- [ ] **Step 3: Implement defensive schema traversal**

Use structural record guards so the inference package remains independent of parser internals. Maximum depth is 32. Track visited semantic schema identities. Return diagnostics instead of throwing.

- [ ] **Step 4: Write failing indexer tests**

Construct two normalized operations and assert:

- 2xx response body fields become sources.
- Error response fields do not become sources when explicit success responses exist.
- Parameters and request-body fields become targets.
- Security requirements create a synthetic Authorization/security target.
- Ordering is deterministic.
- Example/default literal values do not enter indexes.

- [ ] **Step 5: Implement indexes and verify GREEN**

Run:

```bash
pnpm --filter @api-schema-flow/inference test -- schema-walker.test.ts indexer.test.ts
pnpm --filter @api-schema-flow/inference typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/inference/src packages/inference/tests/unit
git commit -m "feat(inference): index response and request values"
```

---

### Task 5: Generate plausible pairs and enforce hard constraints

**Files:**
- Create: `packages/inference/src/pair-generator.ts`
- Create: `packages/inference/src/blockers.ts`
- Create: `packages/inference/src/declared-mapping-index.ts`
- Create: `packages/inference/tests/unit/pair-generator.test.ts`
- Create: `packages/inference/tests/unit/blockers.test.ts`
- Modify: `packages/inference/src/index.ts`

**Interfaces:**
- Produces internal `CandidatePair`, `generateCandidatePairs(indexes, config)`, `evaluateBlockers(pair, declaredIndex)`, and `buildDeclaredMappingIndex(graph)`.

- [ ] **Step 1: Write failing pair-generation tests**

Assert that pair generation:

- Finds exact and normalized names.
- Finds resource-qualified IDs.
- Finds explicit bearer-token targets.
- Finds POST collection → GET item lifecycle pairs.
- Does not allocate a full cross product for unrelated fields.
- Stops deterministically at `maximumPairEvaluations`.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @api-schema-flow/inference test -- pair-generator.test.ts
```

- [ ] **Step 3: Implement indexed pair generation**

Deduplicate candidate pairs by canonical source/target key before blockers and scoring.

- [ ] **Step 4: Write failing blocker tests**

Required blockers:

- Same operation.
- Incompatible object/array/scalar type.
- Array source without selector.
- Write-only source.
- Read-only target.
- Secret-shaped source to ordinary target.
- Declared-equivalent data mapping.
- Immediate reverse of a declared dependency.

- [ ] **Step 5: Implement blocker evaluation and verify GREEN**

Run:

```bash
pnpm --filter @api-schema-flow/inference test -- pair-generator.test.ts blockers.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/inference/src packages/inference/tests/unit
git commit -m "feat(inference): bound candidate pairs and enforce blockers"
```

---

### Task 6: Add evidence rules, score aggregation, caps, and ranking

**Files:**
- Create: `packages/inference/src/rules.ts`
- Create: `packages/inference/src/scoring.ts`
- Create: `packages/inference/src/ranking.ts`
- Create: `packages/inference/tests/unit/rules.test.ts`
- Create: `packages/inference/tests/unit/scoring.test.ts`
- Create: `packages/inference/tests/unit/ranking.test.ts`
- Modify: `packages/inference/src/index.ts`

**Interfaces:**
- Produces: `evaluateEvidence(pair)`, `scoreEvidence(evidence, pair)`, `confidenceBand(value)`, and `rankAndLimitCandidates(candidates, config)`.

- [ ] **Step 1: Write table-driven failing evidence-rule tests**

Cover every rule in the Design Spec and assert stable rule ID, sign, weight, summary, and source pointers.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @api-schema-flow/inference test -- rules.test.ts
```

- [ ] **Step 3: Implement independent pure evidence rules**

A rule receives only a pair and returns zero or one evidence item. Wrap rule invocation so one failure emits `ASF-INF-9000` and does not stop other rules.

- [ ] **Step 4: Write failing score/cap tests**

Assert:

- Score sum is deterministic.
- `score >= 100` maps to `0.99`.
- Generic `id` without resource evidence caps at `0.59`.
- Weak tag/operation evidence caps at `0.59`.
- Unknown type plus normalized name caps at `0.74`.
- High/medium/low/hidden boundaries are exact.

- [ ] **Step 5: Implement scoring and confidence bands**

- [ ] **Step 6: Write and implement ranking/Top-K tests**

Assert the ordering from the Design Spec, then apply target Top-K and global maximum deterministically.

- [ ] **Step 7: Verify GREEN**

```bash
pnpm --filter @api-schema-flow/inference test -- rules.test.ts scoring.test.ts ranking.test.ts
pnpm --filter @api-schema-flow/inference typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/inference/src packages/inference/tests/unit
git commit -m "feat(inference): score explainable dependency evidence"
```

---

### Task 7: Assemble the deterministic inference report

**Files:**
- Create: `packages/inference/src/run-inference.ts`
- Create: `packages/inference/tests/unit/run-inference.test.ts`
- Create: `packages/inference/tests/integration/reservation-inference.test.ts`
- Modify: `packages/inference/src/index.ts`

**Interfaces:**
- Produces: `runInference(input: InferenceInput): InferenceReport`.
- Uses all previous task interfaces.

- [ ] **Step 1: Write failing report tests**

Assert:

- Every result is inferred/candidate.
- Candidate IDs are stable across project revision changes.
- Candidate output is byte-equivalent across repeat runs.
- Existing declared mappings are absent.
- Candidate/evaluation truncation emits stable diagnostics.
- Statistics count sources, targets, pairs, blockers, rules, and bands.
- Invalid config emits `ASF-INF-1001` and safe defaults are applied.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @api-schema-flow/inference test -- run-inference.test.ts
```

- [ ] **Step 3: Implement the orchestration facade**

The order is:

```text
validate config
→ build indexes
→ generate pairs
→ evaluate blockers
→ evaluate evidence
→ score and cap
→ build stable candidate
→ rank and limit
→ sort diagnostics and statistics
```

- [ ] **Step 4: Add canonical Reservation integration test**

Load or construct the four normalized operations and assert candidates for:

- login token → secured downstream operation.
- spaces item ID → reservation request `spaceId`.
- create reservation ID → get reservation path `id`.

No candidate may be accepted.

- [ ] **Step 5: Verify GREEN**

```bash
pnpm --filter @api-schema-flow/inference test
pnpm --filter @api-schema-flow/inference test:integration
```

- [ ] **Step 6: Commit**

```bash
git add packages/inference/src packages/inference/tests
git commit -m "feat(inference): assemble deterministic candidate reports"
```

---

### Task 8: Add labeled benchmark fixtures and metric gates

**Files:**
- Create: `fixtures/inference/**/openapi.yaml`
- Create: `fixtures/inference/**/labels.json`
- Create: `packages/inference/src/benchmark.ts`
- Create: `packages/inference/tests/integration/benchmark.test.ts`
- Create: `tooling/scripts/run-inference-benchmark.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `evaluateInferenceBenchmark(cases)` and root command `pnpm benchmark:inference`.

- [ ] **Step 1: Add the eleven fixture classes from the Design Spec**

Every label must identify source operation/selector and target operation/target descriptor. Include positive and negative labels. Do not include credentials or proprietary schemas.

- [ ] **Step 2: Write failing benchmark metric test**

Assert:

```text
highConfidencePrecision >= 0.85
genericIdHighFalsePositives == 0
declaredMappingsReemitted == 0
deterministic == true
```

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @api-schema-flow/inference test:integration -- benchmark.test.ts
```

- [ ] **Step 4: Implement benchmark evaluation and calibrate only documented weights/caps**

Do not add fixture-specific code. Any rule-weight change must update `INFERENCE_RULE_SET_VERSION` if behavior changes after first committed release candidate.

- [ ] **Step 5: Add 500-operation performance gate**

`run-inference-benchmark.mjs` generates synthetic operations and fails when runtime exceeds 5000 ms or evaluation budgets are violated.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm benchmark:inference
pnpm --filter @api-schema-flow/inference test:integration
```

- [ ] **Step 7: Commit**

```bash
git add fixtures/inference packages/inference package.json tooling/scripts/run-inference-benchmark.mjs
git commit -m "test(inference): add labeled precision benchmark"
```

---

### Task 9: Add `schema-flow infer` CLI composition

**Files:**
- Create: `packages/cli/src/infer-command.ts`
- Create: `packages/cli/src/inference-report.ts`
- Create: `packages/cli/tests/unit/inference-report.test.ts`
- Create: `packages/cli/tests/integration/infer-command.test.ts`
- Modify: `packages/cli/src/run-cli.ts`
- Modify: `packages/cli/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- CLI consumes `runInference()` and existing OpenAPI source acquisition/normalization.
- Produces stable human and JSON output matching the Design Spec.

- [ ] **Step 1: Write failing CLI report tests**

Test human summary and JSON schema, including redaction and deterministic candidate order.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @api-schema-flow/cli test -- inference-report.test.ts
```

- [ ] **Step 3: Implement report formatting**

Human output displays counts and top candidate rule IDs, not literal example values. JSON passes candidates, diagnostics, and statistics through the existing redaction facade.

- [ ] **Step 4: Write failing integration tests**

Cover:

```bash
schema-flow infer examples/reservation/openapi.yaml
schema-flow infer examples/reservation/openapi.yaml --json
schema-flow infer missing.yaml
schema-flow infer examples/reservation/openapi.yaml --minimum-confidence 2
```

Assert exit codes `0`, `1`, `2`, and `3` remain consistent with existing conventions.

- [ ] **Step 5: Implement argument parsing and command composition**

Reuse existing source-policy flags. Add `--include-hidden`, `--minimum-confidence`, `--max-candidates`, and `--top-k`.

- [ ] **Step 6: Update lockfile and verify GREEN**

```bash
pnpm install --lockfile-only
pnpm --filter @api-schema-flow/cli test
pnpm --filter @api-schema-flow/cli test:integration
node packages/cli/bin/schema-flow.mjs infer examples/reservation/openapi.yaml
node packages/cli/bin/schema-flow.mjs infer examples/reservation/openapi.yaml --json
```

- [ ] **Step 7: Commit**

```bash
git add packages/cli pnpm-lock.yaml
git commit -m "feat(cli): add evidence-based infer command"
```

---

### Task 10: Documentation, security scan, and final verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Create: `docs/reports/m2c-inference-verification.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Documents only implemented behavior and explicit limitations.
- CI adds inference benchmark and CLI smoke verification.

- [ ] **Step 1: Update documentation**

Document:

- M2-C status.
- `schema-flow infer` examples.
- Candidate-only semantics.
- Confidence limitations.
- No LLM, execution, decision persistence, or Web UI.
- Benchmark and performance gates.

- [ ] **Step 2: Add CI inference gates**

Run `pnpm benchmark:inference` and a JSON CLI smoke test. Keep repository permissions read-only.

- [ ] **Step 3: Scan generated outputs for sensitive values**

Run:

```bash
pnpm benchmark:inference
node packages/cli/bin/schema-flow.mjs infer examples/reservation/openapi.yaml --json > /tmp/inference.json
! grep -Eqi 'synthetic-password|synthetic-jwt-token|authorization:[[:space:]]*bearer[[:space:]]+[^[]' /tmp/inference.json
```

- [ ] **Step 4: Run complete verification**

```bash
pnpm install --frozen-lockfile
pnpm ci:verify
pnpm benchmark:inference
pnpm test:flow-fixtures
node packages/cli/bin/schema-flow.mjs infer examples/reservation/openapi.yaml
node packages/cli/bin/schema-flow.mjs infer examples/reservation/openapi.yaml --json
git diff --check
```

Expected: every command exits `0` and all tests pass.

- [ ] **Step 5: Record exact evidence**

The report must include environment versions, test counts, benchmark precision/recall, 500-operation runtime, CLI output summary, package-boundary result, head SHA, and known limitations.

- [ ] **Step 6: Commit**

```bash
git add README.md README.zh-TW.md CHANGELOG.md docs/reports/m2c-inference-verification.md .github/workflows/ci.yml
git commit -m "docs: record M2-C inference verification"
```

- [ ] **Step 7: Update Draft PR for owner review**

Include delivered behavior, exact verification evidence, architecture boundaries, benchmark metrics, security notes, review focus, and M2-D follow-up.