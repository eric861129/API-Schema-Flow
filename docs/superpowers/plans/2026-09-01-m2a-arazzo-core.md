# M2-A Arazzo Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parser-independent Arazzo 1.1 core that safely parses and preserves workflow documents, creates a typed Runtime Expression AST, validates semantic references, resolves source and operation targets through abstract catalogs, reports feature support, and exposes the result through `schema-flow validate`.

**Architecture:** A new `@api-schema-flow/arazzo` package owns Arazzo syntax parsing, normalization, semantic validation, Runtime Expression parsing, source URI resolution, operation binding, and support analysis. It depends only on stable project packages plus the YAML parser and must not import `@api-schema-flow/openapi`; operation resolution uses a small package-owned catalog interface. The CLI composes `arazzo` and `openapi`, safely acquires the entry source once through a memoizing `SourceAcquirer`, auto-detects the specification kind, and emits one versioned validation-report contract.

**Tech Stack:** TypeScript 6, Node.js 24, pnpm 11, Turborepo, Vitest 4, `yaml` 2.9, existing source-loader policy and diagnostics packages.

**Spec:** `docs/09-ARAZZO-WORKFLOW-SPEC.md`

## Global Constraints

- Arazzo Specification 1.1.x is the M2-A supported feature baseline.
- The latest verified baseline on 2026-09-01 is Arazzo 1.1.0.
- JSON and YAML inputs are supported; the parser must not execute custom YAML tags.
- The package must preserve unknown `x-*` extensions and unsupported-but-valid fields in serializable objects.
- `@api-schema-flow/arazzo` must not import `@api-schema-flow/openapi`.
- Runtime expressions are parsed into an AST before semantic analysis; execution-time string splitting is forbidden.
- A pure runtime expression preserves the referenced value type; an embedded expression is represented as a string template.
- Source Description URLs resolve against absolute or relative `$self` first, then the retrieval URI.
- AsyncAPI, nested Arazzo workflow calls, async `send`/`receive`, `goto`, JSONPath, XPath, and regex evaluation are preserve-only in M2-A.
- Preserve-only features must never be silently reported as executable.
- Operation binding is deterministic and must fail on missing or ambiguous targets rather than choosing one.
- Diagnostics are stable, source-addressable, deterministic, and redacted before CLI output.
- Existing OpenAPI validation behavior and M1-B security policy must remain unchanged.
- No workflow execution, graph editing, inference, export, mock runtime, or Web UI is implemented in this slice.

---

### Task 1: Arazzo Package, Version Detection, and Safe Parsing

**Files:**
- Create: `packages/arazzo/package.json`
- Create: `packages/arazzo/tsconfig.json`
- Create: `packages/arazzo/src/index.ts`
- Create: `packages/arazzo/src/object-utils.ts`
- Create: `packages/arazzo/src/version.ts`
- Create: `packages/arazzo/src/parse-arazzo.ts`
- Modify: `packages/diagnostics/src/codes.ts`
- Modify: `pnpm-lock.yaml`
- Test: `packages/arazzo/tests/unit/version.test.ts`
- Test: `packages/arazzo/tests/unit/parse-arazzo.test.ts`

**Interfaces:**
- Produces `ArazzoVersionResult`, `detectArazzoVersion(input, sourceUri)`, `ParsedArazzoSource`, `ParseArazzoSourceResult`, `parseArazzoSource(source)` and `looksLikeArazzoSource(source)`.
- `ParsedArazzoSource.document` is a plain record without YAML parser types.

- [ ] **Step 1: Write failing version and parser tests**

```ts
expect(detectArazzoVersion({ arazzo: '1.1.0' }, 'memory://workflow')).toMatchObject({
  version: '1.1.0',
  compatibilityMode: false,
  diagnostics: [],
})

expect(parseArazzoSource(yamlSource).document).toMatchObject({
  arazzo: '1.1.0',
  info: { title: 'Reservation workflows' },
})
```

Also assert that unsupported `2.0.0`, malformed YAML, arrays, and empty documents return `ASF-ARZ-*` diagnostics and never throw.

- [ ] **Step 2: Run focused tests and confirm missing-module failures**

Run:

```bash
pnpm --filter @api-schema-flow/arazzo test -- version
pnpm --filter @api-schema-flow/arazzo test -- parse-arazzo
```

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Add the package and exact dependencies**

`packages/arazzo/package.json` declares workspace dependencies on domain, diagnostics, and source-loader plus exact `yaml: 2.9.0`. Add the matching lockfile importer without changing resolved package versions.

- [ ] **Step 4: Implement safe JSON/YAML parsing**

Use `yaml.parse()` with JSON-compatible data only, bounded aliases, no custom tags, and no merge-key expansion. Convert all expected user-input failures into diagnostics. Reject non-object roots.

- [ ] **Step 5: Implement Arazzo version detection**

Accept the `1.1.x` feature line. Patch versions share the 1.1 feature set. Return an unsupported-version error for missing, malformed, or other major/minor versions.

- [ ] **Step 6: Run package build, typecheck, and tests**

```bash
pnpm --filter @api-schema-flow/arazzo build
pnpm --filter @api-schema-flow/arazzo typecheck
pnpm --filter @api-schema-flow/arazzo test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/arazzo packages/diagnostics/src/codes.ts pnpm-lock.yaml
git commit -m "feat(arazzo): add safe Arazzo 1.1 parser"
```

### Task 2: Typed Runtime Expression and Template AST

**Files:**
- Create: `packages/arazzo/src/runtime-expression.ts`
- Create: `packages/arazzo/src/runtime-template.ts`
- Modify: `packages/arazzo/src/index.ts`
- Test: `packages/arazzo/tests/unit/runtime-expression.test.ts`
- Test: `packages/arazzo/tests/unit/runtime-template.test.ts`

**Interfaces:**
- Produces `RuntimeExpression`, `RuntimeExpressionKind`, `RuntimeTemplate`, `RuntimeTemplateSegment`, `parseRuntimeExpression(value, source?)`, `parseRuntimeTemplate(value, source?)`, and `runtimeExpressionStepDependencies(value)`.
- Parse functions return `{ expression?, template?, diagnostics }` and never throw for user input.

- [ ] **Step 1: Write failing tests for every M2-A expression family**

Cover:

```text
$url
$method
$statusCode
$self
$request.header.Authorization
$request.query.filter
$request.path.id
$request.body#/reservation/id
$response.header.X-Rate-Limit
$response.body#/id
$message.payload#/orderId
$inputs.username
$outputs.reservationId
$steps.login.outputs.token
$workflows.checkout.outputs.orderId
$sourceDescriptions.reservationApi.createReservation
$components.parameters.authorization
```

Assert identifiers, source kinds, names, JSON Pointer fragments, and step dependencies.

- [ ] **Step 2: Write failing template tests**

```ts
const result = parseRuntimeTemplate(
  'Bearer {$steps.login.outputs.token} for {$inputs.username}',
)
expect(result.template?.segments).toEqual([
  { kind: 'literal', value: 'Bearer ' },
  expect.objectContaining({ kind: 'expression' }),
  { kind: 'literal', value: ' for ' },
  expect.objectContaining({ kind: 'expression' }),
])
```

Also test a pure expression, multiple embedded expressions, unmatched braces, and literal dollar signs.

- [ ] **Step 3: Verify the tests fail because the parsers are missing**

Run:

```bash
pnpm --filter @api-schema-flow/arazzo test -- runtime-expression
pnpm --filter @api-schema-flow/arazzo test -- runtime-template
```

Expected: FAIL for missing exports.

- [ ] **Step 4: Implement anchored expression parsing**

Use explicit anchored patterns per expression family. Do not use `eval`, dynamic regular-expression construction, or permissive prefix matches. Validate JSON Pointer fragments and identifier grammar.

- [ ] **Step 5: Implement template scanning**

Scan left-to-right, preserving literal segments and parsing only expressions wrapped by `{}`. Return diagnostics for unmatched or invalid embedded expressions. A string containing exactly one unwrapped runtime expression is represented as a pure expression rather than a template.

- [ ] **Step 6: Run tests and refactor only while green**

```bash
pnpm --filter @api-schema-flow/arazzo test
pnpm --filter @api-schema-flow/arazzo typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/arazzo/src packages/arazzo/tests
git commit -m "feat(arazzo): parse typed runtime expressions"
```

### Task 3: Normalized Arazzo Semantic Model and Preservation

**Files:**
- Create: `packages/arazzo/src/model.ts`
- Create: `packages/arazzo/src/source-pointer.ts`
- Create: `packages/arazzo/src/normalize-value.ts`
- Create: `packages/arazzo/src/normalize-arazzo.ts`
- Modify: `packages/arazzo/src/index.ts`
- Test: `packages/arazzo/tests/unit/normalize-arazzo.test.ts`

**Interfaces:**
- Produces `NormalizedArazzoDocument`, `NormalizedArazzoInfo`, `NormalizedArazzoSourceDescription`, `NormalizedArazzoWorkflow`, `NormalizedArazzoStep`, `NormalizedArazzoParameter`, `NormalizedArazzoRequestBody`, `NormalizedArazzoCriterion`, `NormalizedArazzoAction`, `ArazzoOperationTarget`, and `normalizeArazzoDocument(parsed, source)`.
- Every root/source/workflow/step/parameter/criterion/action includes a `SourcePointer`.
- Every object exposes `extensions` and `preservedFields` as serializable records.

- [ ] **Step 1: Write a failing canonical Reservation normalization test**

Assert deterministic ordering and preservation for:

```text
$self
info
sourceDescriptions
workflow inputs
workflow parameters
ordered steps
operationId / operationPath / workflowId / channelPath targets
step parameters
requestBody
successCriteria
outputs
dependsOn
timeout
action
onSuccess / onFailure
components
x-schema-flow and unknown valid fields
```

- [ ] **Step 2: Verify the normalization test fails**

Run: `pnpm --filter @api-schema-flow/arazzo test -- normalize-arazzo`
Expected: FAIL because model and normalizer exports are missing.

- [ ] **Step 3: Implement small, focused normalizers**

Normalize each object without mutating parsed input. Keep workflow step array order. Sort maps only where order is not semantic. Parse runtime-expression-bearing values recursively into expression/template/literal value nodes while preserving the original value.

- [ ] **Step 4: Preserve unsupported and extension fields**

Known `x-*` keys go to `extensions`. Unknown non-extension fields go to `preservedFields`; they are not silently discarded and later support analysis can classify them.

- [ ] **Step 5: Run deterministic repeat and mutation-safety assertions**

Normalize the same object twice and compare deeply. Confirm modifying the original parsed input after normalization does not mutate the normalized output.

- [ ] **Step 6: Run package tests**

```bash
pnpm --filter @api-schema-flow/arazzo test
pnpm --filter @api-schema-flow/arazzo build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/arazzo/src packages/arazzo/tests
git commit -m "feat(arazzo): normalize and preserve workflow documents"
```

### Task 4: Semantic Validation, Dependencies, and Support Analysis

**Files:**
- Create: `packages/arazzo/src/semantic-validation.ts`
- Create: `packages/arazzo/src/dependency-analysis.ts`
- Create: `packages/arazzo/src/support-analysis.ts`
- Modify: `packages/arazzo/src/model.ts`
- Modify: `packages/arazzo/src/index.ts`
- Modify: `packages/diagnostics/src/codes.ts`
- Test: `packages/arazzo/tests/unit/semantic-validation.test.ts`
- Test: `packages/arazzo/tests/unit/dependency-analysis.test.ts`
- Test: `packages/arazzo/tests/unit/support-analysis.test.ts`

**Interfaces:**
- Produces `validateArazzoDocument(document)`, `analyzeWorkflowDependencies(workflow)`, `analyzeArazzoSupport(document)`, `ArazzoSupportLevel`, `ArazzoFeatureSupport`, `ArazzoWorkflowSupport`, and `ArazzoSupportReport`.
- Support levels are `supported`, `preserve-only`, and `invalid`.

- [ ] **Step 1: Write failing semantic-validation tests**

Cover duplicate source names, duplicate workflow IDs, duplicate step IDs, zero or multiple step targets, missing `dependsOn` steps, dependency cycles, missing step outputs, forward output references, malformed Runtime Expressions, and duplicate parameter identity.

- [ ] **Step 2: Write failing dependency-analysis tests**

Assert explicit `dependsOn` plus `$steps.<id>.outputs.<name>` implicit dependencies, deterministic topological order, missing-reference diagnostics, forward-reference metadata, and cycle diagnostics.

- [ ] **Step 3: Write failing support-profile tests**

Expected classifications:

```text
OpenAPI operationId/operationPath synchronous step -> supported
AsyncAPI source, channelPath, send/receive -> preserve-only
workflowId step -> preserve-only
regex/jsonpath/xpath criteria -> preserve-only
onFailure retry/end -> supported metadata, not executed in M2-A
goto -> preserve-only
unknown extension -> supported preservation
unknown non-extension field -> preserve-only
invalid target/reference -> invalid
```

- [ ] **Step 4: Verify focused tests fail**

Run:

```bash
pnpm --filter @api-schema-flow/arazzo test -- semantic-validation
pnpm --filter @api-schema-flow/arazzo test -- dependency-analysis
pnpm --filter @api-schema-flow/arazzo test -- support-analysis
```

Expected: FAIL for missing implementations.

- [ ] **Step 5: Implement deterministic validation**

Return all diagnostics in stable order. Do not stop after the first semantic error unless continuing would be unsafe. Attach workflow and step source pointers to diagnostics.

- [ ] **Step 6: Implement support analysis independent of execution code**

Support analysis describes whether the planned MVP executor can eventually consume the feature. M2-A itself does not execute workflows. Preserve-only features remain in the normalized model.

- [ ] **Step 7: Run all Arazzo tests**

```bash
pnpm --filter @api-schema-flow/arazzo test
pnpm --filter @api-schema-flow/arazzo typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/arazzo packages/diagnostics/src/codes.ts
git commit -m "feat(arazzo): validate dependencies and report support"
```

### Task 5: Source URI and Abstract Operation Resolution

**Files:**
- Create: `packages/arazzo/src/source-resolution.ts`
- Create: `packages/arazzo/src/operation-catalog.ts`
- Create: `packages/arazzo/src/operation-resolution.ts`
- Modify: `packages/arazzo/src/model.ts`
- Modify: `packages/arazzo/src/index.ts`
- Test: `packages/arazzo/tests/unit/source-resolution.test.ts`
- Test: `packages/arazzo/tests/unit/operation-resolution.test.ts`

**Interfaces:**
- Produces `resolveArazzoBaseUri(document, retrievalUri)`, `resolveSourceDescriptionUris(document, retrievalUri)`, `ArazzoOperationCatalog`, `ArazzoCatalogOperation`, `ResolvedArazzoOperation`, and `resolveArazzoOperations(document, catalogs)`.
- `ArazzoOperationCatalog` contains only project-owned primitives and has no OpenAPI package types.

- [ ] **Step 1: Write failing base-URI tests**

Cover absolute `$self`, relative `$self`, no `$self`, file retrieval URIs, HTTPS retrieval URIs, invalid fragments in `$self`, and relative Source Description URLs.

- [ ] **Step 2: Write failing operation-resolution tests**

Cover:

```text
single-source unqualified operationId
qualified $sourceDescriptions.<name>.<operationId>
operationPath using {$sourceDescriptions.<name>.url}#/paths/... pointer
missing target
ambiguous unqualified operationId
source-type mismatch
nested Arazzo workflow target preserved but not executable
```

- [ ] **Step 3: Verify tests fail for missing resolvers**

Run:

```bash
pnpm --filter @api-schema-flow/arazzo test -- source-resolution
pnpm --filter @api-schema-flow/arazzo test -- operation-resolution
```

Expected: FAIL.

- [ ] **Step 4: Implement RFC 3986 URI resolution using the platform URL API**

File paths are already canonical file URLs by the time they reach the Arazzo package. `$self` must not contain a fragment. Preserve the authored URL and store a resolved URI separately.

- [ ] **Step 5: Implement deterministic catalog binding**

Prefer an explicitly qualified source. Resolve unqualified operation IDs only when exactly one catalog operation matches. Preserve unresolved targets and emit stable diagnostics instead of dropping steps.

- [ ] **Step 6: Run all Arazzo tests**

```bash
pnpm --filter @api-schema-flow/arazzo test
pnpm --filter @api-schema-flow/arazzo build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/arazzo/src packages/arazzo/tests
git commit -m "feat(arazzo): resolve workflow sources and operations"
```

### Task 6: CLI Auto-detection and Arazzo Validation Report

**Files:**
- Create: `packages/cli/src/specification-kind.ts`
- Create: `packages/cli/src/memoized-source-acquirer.ts`
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/run-cli.ts`
- Modify: `packages/cli/src/validate-command.ts`
- Modify: `packages/cli/tests/unit/run-cli.test.ts`
- Create: `packages/cli/tests/unit/specification-kind.test.ts`
- Modify: `packages/cli/tests/integration/validate-command.integration.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- CLI dependencies gain `processArazzoSource?(source)` while preserving current OpenAPI injection points.
- `ValidationReport` gains `specificationKind`, `arazzoVersion`, `workflowCount`, `stepCount`, `support`, and retains all OpenAPI fields as optional.
- Produces `detectSpecificationKind(source)` and `createMemoizedSourceAcquirer(base)`.

- [ ] **Step 1: Write failing auto-detection tests**

Test JSON/YAML Arazzo, OpenAPI 3.0/3.1/3.2, malformed structured input, and an unknown object. Detection must not infer Arazzo from filename alone.

- [ ] **Step 2: Write a failing CLI Arazzo integration test**

```bash
node packages/cli/bin/schema-flow.mjs validate examples/reservation/arazzo.yaml --json
```

Assert exit code `0`, `specificationKind: "arazzo"`, version `1.1.0`, workflow and step counts, support summary, and redacted diagnostics.

- [ ] **Step 3: Verify the tests fail**

Run:

```bash
pnpm --filter @api-schema-flow/cli test
pnpm --filter @api-schema-flow/cli test:integration
```

Expected: FAIL because Arazzo orchestration is absent.

- [ ] **Step 4: Add the Arazzo workspace dependency and lockfile importer**

The CLI is the composition layer and may depend on both `openapi` and `arazzo`. Neither parser package may depend on the other.

- [ ] **Step 5: Implement safe one-entry acquisition and memoization**

Acquire the entry source through the existing policy and budget. Cache the exact result by canonical location so OpenAPI graph processing does not perform a second file or network read. External references still use the underlying acquirer and policy.

- [ ] **Step 6: Produce specification-specific human and JSON reports**

Human output must say `Arazzo document loaded` for Arazzo and `OpenAPI document loaded` for OpenAPI. Preserve stable exit-code rules: source/CLI failures `2`, specification errors `1`, internal errors `3`.

- [ ] **Step 7: Run CLI and regression tests**

```bash
pnpm --filter @api-schema-flow/cli test
pnpm --filter @api-schema-flow/cli test:integration
pnpm test
pnpm test:integration
```

Expected: PASS with existing OpenAPI behavior unchanged.

- [ ] **Step 8: Commit**

```bash
git add packages/cli pnpm-lock.yaml
git commit -m "feat(cli): validate Arazzo workflows automatically"
```

### Task 7: Canonical Fixture, Documentation, and Release Evidence

**Files:**
- Create: `examples/reservation/arazzo.yaml`
- Create: `fixtures/arazzo/valid/reservation.yaml`
- Create: `fixtures/arazzo/unsupported-valid/async-step.yaml`
- Create: `fixtures/arazzo/invalid/duplicate-step.yaml`
- Create: `fixtures/arazzo/runtime-expressions/core.yaml`
- Create: `packages/arazzo/tests/integration/reservation-arazzo.integration.test.ts`
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Create: `docs/reports/m2a-arazzo-verification.md`
- Modify: `tooling/scripts/check-workspace.mjs` only if it contains an explicit package allowlist.
- Modify: `tooling/scripts/check-boundaries.mjs` to enforce OpenAPI/Arazzo independence.

**Interfaces:**
- Produces the canonical Reservation workflow and a durable M2-A verification report.
- Boundary check rejects imports from `@api-schema-flow/openapi` inside `packages/arazzo` and vice versa.

- [ ] **Step 1: Add synthetic, credential-free fixtures**

The canonical workflow contains login, list spaces, create reservation, and get reservation steps with inputs, outputs, parameters, request body, criteria, explicit dependencies, and embedded Runtime Expressions.

- [ ] **Step 2: Write the failing end-to-end package integration test**

Load the fixture through source-loader, parse and normalize it, validate dependencies, resolve its source URL, analyze support, and bind operations using a synthetic catalog. Assert zero errors and stable normalized output.

- [ ] **Step 3: Verify the integration test fails before fixture wiring is complete**

Run: `pnpm --filter @api-schema-flow/arazzo test:integration`
Expected: FAIL until the fixture and orchestration are complete.

- [ ] **Step 4: Complete fixture wiring and boundary checks**

Ensure no network access is required. Add explicit architecture checks for parser-package independence and public declaration leaks.

- [ ] **Step 5: Update honest project status documentation**

README must list M2-A as implemented while keeping workflow execution, UI, inference, mock runtime, and export marked as planned. Add the exact CLI Arazzo validation example.

- [ ] **Step 6: Run the complete verification gate**

```bash
pnpm install --frozen-lockfile
pnpm ci:verify
node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml --json
node packages/cli/bin/schema-flow.mjs validate examples/reservation/arazzo.yaml --json
git diff --check
```

Expected: every command exits `0`; OpenAPI and Arazzo reports identify the correct specification kind.

- [ ] **Step 7: Record evidence and commit**

`docs/reports/m2a-arazzo-verification.md` records the exact commit SHA placeholder as `HEAD at verification`, commands, test counts, support limitations, and successful GitHub Actions run after the final push.

```bash
git add examples fixtures packages README.md README.zh-TW.md CHANGELOG.md tooling docs/reports
git commit -m "docs: publish M2-A Arazzo core status"
```

## Completion Gate

M2-A is complete only when all conditions are true:

- Arazzo 1.1 JSON and YAML parse without parser-specific public types.
- Unknown extensions and preserve-only fields survive normalization.
- Runtime Expressions and embedded templates produce typed AST nodes.
- Explicit and implicit workflow dependencies are deterministic and validated.
- Source Description URIs respect `$self` and retrieval-URI rules.
- Operation targets bind through an abstract catalog without OpenAPI package coupling.
- Support reports clearly distinguish supported, preserve-only, and invalid features.
- `schema-flow validate` auto-detects and reports OpenAPI and Arazzo.
- Existing M1-B source-security behavior remains covered and green.
- Full CI, integration tests, boundary checks, and both CLI smoke tests pass.
- No workflow execution, inference, canvas, mock runtime, or export capability is falsely advertised.
