# M2-C Evidence-Based Inference Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, explainable, conservative OpenAPI inference engine that emits reviewable candidates but never accepts them.

**Architecture:** Add serializable candidate/evidence contracts to `@api-schema-flow/domain`, then implement field indexing, bounded pair generation, hard constraints, evidence rules, score aggregation, declared-edge suppression, benchmarks, and CLI reporting in a framework-free `@api-schema-flow/inference` package. The engine consumes normalized OpenAPI sources plus the M2-B declared operation graph; it never imports parser internals or mutates the graph.

**Tech Stack:** TypeScript 6, pnpm 11, Turborepo, Vitest 4, existing normalized OpenAPI/Flow contracts, Node.js 24.

**Spec:** `docs/superpowers/specs/2026-09-02-m2c-inference-core-design.md`

## Global Constraints

- Rule set version is exactly `m2c-v1`.
- Every emitted candidate is `provenance: 'inferred'` and `status: 'candidate'`.
- Default minimum confidence is `0.60`.
- High-confidence benchmark precision must be at least `0.85`.
- Generic `id` evidence alone may not exceed confidence `0.59`.
- Array-item-to-scalar mappings require a selector and are blocked in M2-C.
- Existing declared mappings are suppressed, not duplicated or rescored.
- Candidate and evidence output must not include schema examples/default values or runtime secrets.
- The inference package must not depend on OpenAPI/Arazzo parser packages, React, React Flow, ELK, Fastify, Hono, MSW, Mock Runtime, or Execution Runtime.
- The 500-operation synthetic inference gate must complete within `5_000 ms` in CI.

---

## File map

### Domain contracts

- Create `packages/domain/src/inference.ts`: serializable evidence, candidate, confidence, metrics, and report contracts.
- Modify `packages/domain/src/index.ts`: export inference contracts and constants.
- Create `packages/domain/tests/unit/inference-contract.test.ts`: serialization and invariant tests.

### Inference package

- Create `packages/inference/package.json`: workspace package with no external runtime dependency.
- Create `packages/inference/tsconfig.json`: strict build configuration.
- Create `packages/inference/src/contracts.ts`: input/config/internal field contracts.
- Create `packages/inference/src/config.ts`: defaults and validation.
- Create `packages/inference/src/name-normalization.ts`: deterministic tokenization and resource normalization.
- Create `packages/inference/src/schema-fields.ts`: bounded response/request field extraction.
- Create `packages/inference/src/operation-index.ts`: endpoint binding and candidate indexes.
- Create `packages/inference/src/canonical.ts`: candidate/schema fingerprints using Flow canonical JSON.
- Create `packages/inference/src/declared-suppression.ts`: canonical declared mapping index.
- Create `packages/inference/src/topology.ts`: cycle-risk reachability.
- Create `packages/inference/src/rules.ts`: hard blockers and evidence rules.
- Create `packages/inference/src/scoring.ts`: deterministic score/confidence/band mapping.
- Create `packages/inference/src/infer-flow-candidates.ts`: bounded pipeline and report.
- Create `packages/inference/src/benchmark.ts`: labeled benchmark evaluator.
- Create `packages/inference/src/index.ts`: public API.

### Tests and fixtures

- Create focused tests under `packages/inference/tests/unit/`.
- Create `packages/inference/tests/integration/benchmark.integration.test.ts`.
- Create `packages/inference/tests/integration/performance.integration.test.ts`.
- Create `fixtures/inference/benchmark/cases.json`.
- Create `fixtures/inference/benchmark/README.md`.

### CLI

- Create `packages/cli/src/infer-options.ts`.
- Create `packages/cli/src/infer-command.ts`.
- Modify `packages/cli/src/run-cli.ts`.
- Modify `packages/cli/src/index.ts` when public exports are required.
- Modify `packages/cli/package.json` to depend on inference and flow.
- Create `packages/cli/tests/unit/infer-options.test.ts`.
- Create `packages/cli/tests/unit/infer-command.test.ts`.
- Create `packages/cli/tests/integration/infer-cli.integration.test.ts`.

### Repository gates and documentation

- Modify `package.json` with inference test/benchmark commands.
- Modify `tooling/scripts/check-workspace.mjs` to require the package and scripts.
- Modify `tooling/scripts/check-boundaries.mjs` with inference boundaries.
- Modify `README.md`, `README.zh-TW.md`, and `CHANGELOG.md`.
- Create `docs/reports/m2c-inference-core-verification.md`.

---

### Task 1: Lock the domain candidate contract

**Files:**
- Test: `packages/domain/tests/unit/inference-contract.test.ts`
- Create: `packages/domain/src/inference.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces `INFERENCE_SCHEMA_VERSION`, `INFERRED_FLOW_PROVENANCE`, `CANDIDATE_FLOW_STATUS`, `InferenceEvidence`, `InferenceCandidate`, `InferenceMetrics`, and `InferenceReport`.
- Consumes existing `FlowDataMapping` and `SourcePointer`.

- [ ] **Step 1: Write failing contract tests**

Assert constants, JSON serialization, non-empty evidence, and a candidate shaped as:

```ts
const candidate: InferenceCandidate = {
  schemaVersion: '1.0',
  id: 'candidate:abc',
  fingerprint: 'abc',
  ruleSetVersion: 'm2c-v1',
  sourceOperationNodeId: 'endpoint:api:operation:post:/reservations',
  targetOperationNodeId: 'endpoint:api:operation:get:/reservations/{id}',
  sourceOperationKey: 'operation:post:/reservations',
  targetOperationKey: 'operation:get:/reservations/{id}',
  mapping,
  score: 82,
  confidence: 0.95,
  band: 'high',
  evidence: [evidence],
  blockers: [],
  provenance: 'inferred',
  status: 'candidate',
}
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `pnpm --filter @api-schema-flow/domain test -- inference-contract.test.ts`  
Expected: FAIL because inference exports do not exist.

- [ ] **Step 3: Implement minimal contracts and exports**

Use readonly, JSON-serializable fields only. Do not import inference package types into domain.

- [ ] **Step 4: Run domain tests and verify GREEN**

Run: `pnpm --filter @api-schema-flow/domain test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): add inference candidate contracts"
```

### Task 2: Add package skeleton, configuration, and deterministic naming

**Files:**
- Create: `packages/inference/package.json`
- Create: `packages/inference/tsconfig.json`
- Create: `packages/inference/src/contracts.ts`
- Create: `packages/inference/src/config.ts`
- Create: `packages/inference/src/name-normalization.ts`
- Create: `packages/inference/src/index.ts`
- Test: `packages/inference/tests/unit/config.test.ts`
- Test: `packages/inference/tests/unit/name-normalization.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `INFERENCE_RULE_SET_VERSION = 'm2c-v1'`.
- Produces `DEFAULT_INFERENCE_CONFIG` and `resolveInferenceConfig()`.
- Produces `normalizeFieldName()`, `normalizeResourceSegment()`, and `meaningfulOperationTokens()`.

- [ ] **Step 1: Write failing config and name tests**

Cover defaults, invalid ranges, camel/snake/kebab equivalence, Unicode NFKC, wrapper tokens, resource singularization, and generic-name detection.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @api-schema-flow/inference test -- config.test.ts name-normalization.test.ts`  
Expected: FAIL because package/functions do not exist.

- [ ] **Step 3: Implement package and minimal deterministic functions**

No external runtime library is allowed. Validation returns stable `ASF-INF-1001` diagnostics rather than throwing for user config.

- [ ] **Step 4: Generate the lockfile and run focused tests**

Run: `pnpm install --lockfile-only` then focused tests.  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/inference pnpm-lock.yaml
git commit -m "feat(inference): add configuration and name normalization"
```

### Task 3: Extract bounded source and target fields

**Files:**
- Create: `packages/inference/src/schema-fields.ts`
- Test: `packages/inference/tests/unit/schema-fields.test.ts`

**Interfaces:**
- Produces `extractOperationSourceFields(operation, config)`.
- Produces `extractOperationTargetFields(operation, config)`.
- Produces internal `InferenceSourceField` and `InferenceTargetField` records from `contracts.ts`.

- [ ] **Step 1: Write failing field-extraction tests**

Cover response object leaves, nested request body, path/query/header targets, `allOf`, variant penalty marker, array depth, successful response selection, source pointers, recursion/cycle termination, readOnly/writeOnly flags, and virtual bearer Authorization targets.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @api-schema-flow/inference test -- schema-fields.test.ts`  
Expected: FAIL because extractors are missing.

- [ ] **Step 3: Implement bounded traversal**

Use structural pointers such as `#/id` and `#/customer/id`. Never read or copy `example` or `defaultValue` into inference records.

- [ ] **Step 4: Run tests and verify GREEN**

Expected: all extraction cases PASS, including an `ASF-INF-1003` warning when depth is exceeded.

- [ ] **Step 5: Commit**

```bash
git add packages/inference/src packages/inference/tests
git commit -m "feat(inference): index structural API fields"
```

### Task 4: Bind operations and build candidate indexes

**Files:**
- Create: `packages/inference/src/operation-index.ts`
- Test: `packages/inference/tests/unit/operation-index.test.ts`

**Interfaces:**
- Consumes `FlowOpenApiSource[]` and an operation-topology `FlowGraph`.
- Produces `InferenceOperationIndex` with operation/node binding, name, resource, type/format, security, and lifecycle indexes.

- [ ] **Step 1: Write failing index tests**

Cover deterministic endpoint binding, missing binding diagnostics, exact/normalized-name buckets, resource-ID buckets, bearer-target buckets, and stable ordering across reversed input.

- [ ] **Step 2: Verify RED**

Expected: missing `buildInferenceOperationIndex()`.

- [ ] **Step 3: Implement index construction**

Use endpoint-node `sourceId + operationKey`; do not infer bindings by array position.

- [ ] **Step 4: Verify GREEN**

Run the complete inference unit suite.

- [ ] **Step 5: Commit**

```bash
git add packages/inference
git commit -m "feat(inference): add bounded operation indexes"
```

### Task 5: Add canonical candidate identities and declared suppression

**Files:**
- Create: `packages/inference/src/canonical.ts`
- Create: `packages/inference/src/declared-suppression.ts`
- Test: `packages/inference/tests/unit/canonical.test.ts`
- Test: `packages/inference/tests/unit/declared-suppression.test.ts`

**Interfaces:**
- Produces `createInferenceFingerprint()` and `createInferenceCandidateId()`.
- Produces `createDeclaredMappingIndex(graph)` and `isDeclaredMapping()`.

- [ ] **Step 1: Write failing determinism tests**

Prove object-key/input-order independence; prove IDs change when source/target/schema fingerprint changes; prove score/evidence/timing do not affect identity.

- [ ] **Step 2: Write failing suppression tests**

A declared data mapping with the same source selector, target, and endpoint pair must be suppressed; a different endpoint or pointer must remain eligible.

- [ ] **Step 3: Verify RED**

Expected: canonical/suppression functions are missing.

- [ ] **Step 4: Implement with `canonicalizeJson()` from Flow**

Use a deterministic in-process hash already accepted by the repository; do not use random IDs or timestamps.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add packages/inference
git commit -m "feat(inference): add stable candidate identity and suppression"
```

### Task 6: Implement topology and hard constraints

**Files:**
- Create: `packages/inference/src/topology.ts`
- Create: `packages/inference/src/constraints.ts`
- Test: `packages/inference/tests/unit/topology.test.ts`
- Test: `packages/inference/tests/unit/constraints.test.ts`

**Interfaces:**
- Produces `wouldCreateDeclaredCycle(graph, sourceNodeId, targetNodeId)`.
- Produces `evaluateHardConstraints(pair, context): InferenceEvidence[]` where every result has `kind: 'blocker'`.

- [ ] **Step 1: Write failing constraint tests**

Cover same-operation, explicit type mismatch, array-selector requirement, writeOnly source, readOnly target, secret to non-security target, declared duplicate, cycle risk, and valid bearer exception.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement graph reachability and blockers**

Do not throw on malformed pairs; emit stable blocker evidence and diagnostics.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/inference
git commit -m "feat(inference): enforce conservative mapping constraints"
```

### Task 7: Implement evidence rules and scoring

**Files:**
- Create: `packages/inference/src/rules.ts`
- Create: `packages/inference/src/scoring.ts`
- Test: `packages/inference/tests/unit/rules.test.ts`
- Test: `packages/inference/tests/unit/scoring.test.ts`

**Interfaces:**
- Produces `evaluateEvidenceRules(pair): InferenceEvidence[]`.
- Produces `scoreInferenceEvidence(evidence)` and `confidenceBand(confidence)`.

- [ ] **Step 1: Write one failing test per rule**

Test exact name, normalized name, resource ID, schema type, schema format, resource path, create-read lifecycle, bearer auth, shared tag, operation token, generic ID, variant penalty, and cross-resource penalty.

- [ ] **Step 2: Write failing score-boundary tests**

Assert exact piecewise boundaries, confidence bands, and generic-ID cap.

- [ ] **Step 3: Verify RED**

- [ ] **Step 4: Implement minimal pure rules and aggregation**

Rules must be independent and deterministic. A rule exception is caught by the pipeline later.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add packages/inference
git commit -m "feat(inference): add explainable evidence scoring"
```

### Task 8: Build the bounded inference pipeline

**Files:**
- Create: `packages/inference/src/infer-flow-candidates.ts`
- Modify: `packages/inference/src/index.ts`
- Test: `packages/inference/tests/unit/infer-flow-candidates.test.ts`

**Interfaces:**
- Produces `inferFlowCandidates(input): InferenceReport`.

- [ ] **Step 1: Write failing vertical-pipeline tests**

Use synthetic reservation operations and assert:

- create-reservation response `id` maps to get-reservation path `id` at high confidence;
- login token maps only to bearer-secured Authorization targets;
- array-based space IDs are blocked;
- generic cross-resource `id` does not emit high candidates;
- declared reservation mapping is suppressed;
- all emitted candidates are inferred/candidate with evidence;
- reversed input produces exactly equal candidates;
- top-K and max-candidate truncation is deterministic.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement pipeline**

Pipeline order:

```text
validate input
→ build indexes
→ generate plausible indexed pairs
→ enforce pair/time budgets
→ hard constraints
→ evidence rules
→ score/confidence/caps
→ declared suppression
→ per-target top-K
→ global limit
→ deterministic sort/report
```

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/inference
git commit -m "feat(inference): generate bounded review candidates"
```

### Task 9: Add benchmark dataset and quality gate

**Files:**
- Create: `fixtures/inference/benchmark/cases.json`
- Create: `fixtures/inference/benchmark/README.md`
- Create: `packages/inference/src/benchmark.ts`
- Create: `packages/inference/tests/helpers/benchmark-fixture.ts`
- Create: `packages/inference/tests/integration/benchmark.integration.test.ts`

**Interfaces:**
- Produces `evaluateInferenceBenchmark(cases, infer): InferenceBenchmarkReport`.

- [ ] **Step 1: Commit labeled cases before observing engine output**

Include exact/aliased ID, generic ID negative, bearer auth, nested resource, array selector, type mismatch, cross-service same-name, cursor, multiple IDs, and declared suppression.

- [ ] **Step 2: Write failing benchmark evaluator tests**

Assert label uniqueness, valid operation/mapping references, precision/recall formulas, and rule-level false-positive counts.

- [ ] **Step 3: Run benchmark and record RED metrics**

Do not change labels to fit generated results.

- [ ] **Step 4: Make the minimal rule/index corrections required by valid labels**

- [ ] **Step 5: Verify quality gate**

Expected:

```text
highConfidencePrecision >= 0.85
genericIdHighFalsePositives = 0
declaredDuplicates = 0
```

- [ ] **Step 6: Commit**

```bash
git add fixtures/inference packages/inference
git commit -m "test(inference): add labeled quality benchmark"
```

### Task 10: Add 500-operation performance gate

**Files:**
- Create: `packages/inference/tests/integration/performance.integration.test.ts`

- [ ] **Step 1: Generate a deterministic 500-operation synthetic input in test code**

Include enough fields to exercise indexes without creating an unbounded pair set.

- [ ] **Step 2: Assert completion within 5,000 ms and configured pair limits**

- [ ] **Step 3: Run repeatedly and remove timing flakiness**

Use the generous regression budget, not a microbenchmark claim.

- [ ] **Step 4: Commit**

```bash
git add packages/inference/tests/integration
git commit -m "test(inference): add bounded performance gate"
```

### Task 11: Add CLI `infer`

**Files:**
- Create: `packages/cli/src/infer-options.ts`
- Create: `packages/cli/src/infer-command.ts`
- Modify: `packages/cli/src/run-cli.ts`
- Modify: `packages/cli/package.json`
- Test: `packages/cli/tests/unit/infer-options.test.ts`
- Test: `packages/cli/tests/unit/infer-command.test.ts`
- Test: `packages/cli/tests/integration/infer-cli.integration.test.ts`

**Interfaces:**
- Adds `schema-flow infer <openapi-file-or-url>`.
- Reuses source-policy flags and produces `InferenceCliReport` schema version `1.0`.

- [ ] **Step 1: Write failing option parser tests**

Cover target, JSON, minimum confidence, top-K, maximum candidates, include-low, and invalid values.

- [ ] **Step 2: Write failing command tests**

Mock normalized processing at the dependency boundary and assert declared graph construction, inference invocation, human output, JSON output, exit codes, and redaction.

- [ ] **Step 3: Implement CLI composition**

The CLI may compose OpenAPI, Flow, and Inference packages. It must not persist decisions or modify input files.

- [ ] **Step 4: Add real CLI integration fixture**

Run against a synthetic OpenAPI file and assert stable candidate/report fields.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add packages/cli pnpm-lock.yaml
git commit -m "feat(cli): add inference report command"
```

### Task 12: Strengthen repository gates

**Files:**
- Modify: `package.json`
- Modify: `tooling/scripts/check-workspace.mjs`
- Modify: `tooling/scripts/check-boundaries.mjs`

- [ ] **Step 1: Add root commands**

```json
{
  "test:inference-benchmark": "pnpm --filter @api-schema-flow/inference test:integration -- benchmark.integration.test.ts",
  "test:inference-performance": "pnpm --filter @api-schema-flow/inference test:integration -- performance.integration.test.ts"
}
```

- [ ] **Step 2: Require the inference package and scripts in workspace checks**

- [ ] **Step 3: Forbid inference imports/dependencies on parser implementations, UI/layout, network/server, mock, and execution runtimes**

- [ ] **Step 4: Run repository gates**

```bash
pnpm workspace:check
pnpm boundaries:check
```

- [ ] **Step 5: Commit**

```bash
git add package.json tooling
git commit -m "ci: enforce inference package boundaries"
```

### Task 13: Update documentation and verification evidence

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Create: `docs/reports/m2c-inference-core-verification.md`

- [ ] **Step 1: Document only implemented behavior**

State clearly that M2-C produces candidates but has no review UI, decisions, Arazzo export, Mock Runtime, or execution.

- [ ] **Step 2: Record TDD evidence, benchmark metrics, performance result, test counts, and exact CI run**

- [ ] **Step 3: Scan for unfinished placeholders and contradictory status claims**

- [ ] **Step 4: Commit**

```bash
git add README.md README.zh-TW.md CHANGELOG.md docs/reports
git commit -m "docs: document M2-C inference core"
```

### Task 14: Final cleanup and exact-head verification

**Files:**
- Remove any one-time lockfile/format/generator workflow or probe file.
- Update Draft PR body.

- [ ] **Step 1: Search for temporary artifacts**

Verify no `m2c-*bootstrap`, probe, generated build output, or placeholder file remains.

- [ ] **Step 2: Run complete verification on one exact commit**

```bash
pnpm install --frozen-lockfile
pnpm ci:verify
pnpm test:inference-benchmark
pnpm test:inference-performance
node packages/cli/bin/schema-flow.mjs infer fixtures/inference/cli/openapi.yaml --json
git diff --check
```

- [ ] **Step 3: Confirm test output, benchmark threshold, performance, and secret scan**

No completion claim is allowed before all commands exit `0`.

- [ ] **Step 4: Push and confirm GitHub Actions on the same SHA**

- [ ] **Step 5: Update Draft PR with delivered scope, metrics, limitations, exact SHA, and successful CI URL**

- [ ] **Step 6: Stop for owner review**

Do not merge M2-C until the repository owner explicitly approves it.

---

## Self-review

- Spec coverage: contracts, indexes, constraints, rules, scoring, deterministic identity, declared suppression, benchmark, performance, CLI, security, boundaries, and documentation each have an implementation task.
- Scope: decision persistence, Arazzo export, UI, execution, Mock Runtime, LLM, and observed edges remain excluded.
- Type consistency: candidates contain one `FlowDataMapping`; evidence uses domain-owned readonly contracts; the pipeline consumes `FlowOpenApiSource[]` plus an operation-topology `FlowGraph`.
- No placeholders: all required behavior, commands, thresholds, files, and interfaces are explicit.
