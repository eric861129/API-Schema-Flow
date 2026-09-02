# M2-C Evidence-Based Inference Core Verification

> Slice: M2-C Evidence-Based Inference Core  
> Branch: `feat/m2c-inference-core`  
> Pull Request: #9  
> Status: owner-approved merge candidate; the exact final-head CI is recorded on the pull request before merge.

## Scope verified

M2-C adds a deterministic, explainable, conservative inference layer above normalized OpenAPI and the M2-B declared operation graph.

Verified capabilities:

- Serializable inference candidate, evidence, metrics, confidence, and configuration contracts.
- Bounded response-source and request-target indexing.
- Deterministic normalization and SHA-256 candidate identity.
- Declared-equivalent mapping suppression.
- Same-operation, incompatible-type, selectorless-array, unsafe-secret-target, and immediate-cycle blockers.
- Exact and normalized name, resource ID, schema type/format, lifecycle, bearer-auth, tag, operation-name, and risk evidence.
- Deterministic scoring, confidence bands, weak-evidence caps, Top-K ranking, pair/candidate budgets, and truncation reporting.
- Synthetic labeled benchmark and 500-operation performance gate.
- End-to-end `schema-flow infer <openapi-file-or-url> [--json]` CLI composition.
- Human-readable and JSON inference reports with redacted diagnostics.
- Permanent CI smoke coverage for both `validate` and `infer` commands.

Every emitted candidate remains:

```text
provenance: inferred
status: candidate
```

M2-C never accepts a candidate automatically and never mutates declared graph truth.

## TDD evidence

### CLI vertical slice

The CLI inference slice was added test-first.

GitHub Actions run `33645409016` failed for the intended RED reasons:

- `executeInferCommand` did not yet exist.
- `parseInferArguments` was not yet exported as a CLI public API.

The implementation then added command parsing, source-policy forwarding, OpenAPI processing, M2-B declared-graph composition, inference execution, human/JSON reporting, and CLI integration coverage.

### Scoring contract correction

An earlier inference test asserted bearer mappings at confidence `0.95`, which contradicted the approved M2-C scoring contract. The rule weights are:

```text
INF-AUTH-BEARER = +65
compatible schema type = +12
score = 77
confidence = 0.88
band = medium
```

The production scoring algorithm was not weakened or altered to satisfy the test. Instead, the stale test expectation and the corresponding benchmark labels were corrected to `0.88` / Medium while the Reservation create-to-read resource-ID mapping remains High confidence.

## Quality benchmark

The committed labeled benchmark verifies:

- high-confidence precision is at least `0.85`;
- all seven labeled positive mappings satisfy their required confidence band;
- generic cross-resource `id -> id` does not become a High-confidence false positive;
- an equivalent OpenAPI Link declaration is not re-emitted as an inferred candidate;
- selectorless array-item inference remains blocked;
- unsafe token-to-non-security mappings remain blocked;
- repeated inference is deterministic.

The benchmark intentionally distinguishes explicit bearer-security evidence from High-confidence resource lifecycle mappings rather than inflating bearer confidence beyond the approved scoring table.

## Performance gate

The committed performance integration test builds a 500-operation synthetic document and requires inference to finish within the `5,000 ms` CI budget.

In the first complete green verification run, Vitest reported the performance integration test completing in approximately `163 ms`. This is test duration evidence, not a promise about all hardware or datasets; the enforced contract remains the 5-second CI budget.

## First complete green verification

GitHub Actions run:

```text
33646883238
```

passed the complete repository gate after the CLI implementation and scoring/benchmark corrections.

Observed verification results included:

```text
Frozen pnpm install / supply-chain policy: passed
Prettier: passed
ESLint: passed
Build: 10 / 10 package tasks passed
Typecheck: 18 / 18 tasks passed
Domain unit tests: 10 passed
Inference unit tests: 20 passed
Flow unit tests: 26 passed
Arazzo unit tests: 62 passed
OpenAPI unit tests: 21 passed
CLI unit tests: 30 passed
Inference benchmark integration: passed
Inference performance integration: passed
CLI inference integration: passed
Flow Golden integration: passed
Package boundaries: passed
Existing validate CLI smoke: passed
```

The permanent CI gate is subsequently extended to smoke-test the real `infer --json` binary command as well. The pull request records the successful exact-final-head run used for merge.

## Security and data handling

Inference output is structural. Candidate identity, evidence, and reports do not persist:

- schema examples;
- schema default values;
- request or response runtime bodies;
- bearer token values;
- passwords;
- cookies;
- API-key values;
- authorization credential values.

Token-like response fields may only be proposed for Authorization when explicit security evidence is present. Diagnostics are sanitized through the existing redaction layer before external CLI output.

## Architecture boundaries

`@api-schema-flow/inference` consumes normalized OpenAPI inputs and the declared operation graph. It does not depend on:

- Scalar or other parser implementations;
- Arazzo parser internals;
- React or React Flow;
- ELK or layout engines;
- Fastify, Hono, or other servers;
- MSW or the future Stateful Mock Runtime;
- the future Workflow Execution Runtime.

`@api-schema-flow/cli` is the composition boundary that may connect source loading, OpenAPI normalization, declared graph projection, and inference.

## Acceptance matrix

| Requirement | Verification |
|---|---|
| Inference output is always candidate-only | Domain/unit/integration assertions |
| Stable deterministic candidate identity | Unit and repeated-run tests |
| Declared mappings are not duplicated | Unit and benchmark assertions |
| Generic ID alone cannot become visible/high confidence | Scoring and benchmark assertions |
| Selectorless array-item inference is blocked | Unit and benchmark assertions |
| Secret-like mappings are constrained | Blocker tests and benchmark assertions |
| Evidence and confidence are explainable | Unit contract and scoring tests |
| High-confidence precision >= 0.85 | Benchmark integration gate |
| Seven labeled positive mappings meet required bands | Benchmark recall assertion |
| 500-operation inference < 5,000 ms in CI | Performance integration gate |
| Real CLI `infer` composes the processing pipeline | CLI unit and integration tests |
| Human and JSON CLI reports are supported | CLI unit tests |
| No runtime secret/example/default values are persisted | Structural contracts and security tests |
| Inference package remains framework-free | Package-boundary gate |

## Final merge gate

Before merge, one exact pull-request head must pass:

```text
pnpm install --frozen-lockfile
pnpm ci:verify
pnpm test:flow-fixtures
pnpm test:inference-benchmark
pnpm test:inference-performance
schema-flow validate smoke
schema-flow infer --json smoke
```

Pull Request #9 must contain no temporary M2-C formatter, lockfile-bootstrap, diagnostic, probe, or CI-trigger artifacts. The exact final head and successful GitHub Actions run are recorded in the PR body immediately before merge.
