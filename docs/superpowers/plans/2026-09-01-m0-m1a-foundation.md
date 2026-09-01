# M0 Foundation + M1-A OpenAPI Core Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a testable TypeScript monorepo that imports the canonical Reservation OpenAPI document, normalizes its operations into the project domain model, and exposes the first `schema-flow validate` CLI command.

**Architecture:** Build small packages with one-way dependencies: `domain` is the stable semantic model; `diagnostics` and `redaction` provide cross-cutting primitives; `config` and `source-loader` handle versioned local inputs; `openapi` owns parsing and normalization behind an adapter; `cli` orchestrates the vertical slice. The first parser adapter uses Scalar, but no Scalar type may cross the `openapi` package boundary.

**Tech Stack:** Node.js 24 LTS, pnpm 11, Turborepo 2, TypeScript 6 strict mode, Vitest 4, ESLint 10, Prettier 3, Zod 4, `@scalar/openapi-parser` 0.29.

**Spec:** `docs/30-IMPLEMENTATION-READINESS-CHECKLIST.md`, section 10; supporting specifications are `docs/06-SYSTEM-ARCHITECTURE.md`, `docs/07-DOMAIN-MODEL.md`, `docs/08-OPENAPI-INGESTION-SPEC.md`, `docs/14-CLI-SPEC.md`, `docs/19-SECURITY-THREAT-MODEL.md`, `docs/20-TEST-STRATEGY.md`, and `docs/22-REPOSITORY-STRUCTURE.md`.

## Global Constraints

- Work only on `feat/m0-m1a-foundation`; do not write directly to `main`.
- The MVP vertical flow remains Import → Review → Mock → Run → Trace → Export, but this plan implements only Foundation + OpenAPI Core.
- OpenAPI 3.0.x and 3.1.x are supported; 3.2.x is accepted in compatibility mode with a warning; Swagger 2.0 is not a Must requirement.
- Arazzo, inference, graph canvas, stateful mock runtime, executor, live trace, and exporters are out of scope.
- Domain/public APIs must not expose Scalar parser types.
- No telemetry, remote URL loading, external `$ref` fetching, arbitrary code execution, or secret persistence.
- All package entry points are `src/index.ts`; deep imports into another package are prohibited.
- Every behavior is developed test-first and verified with a failing test before implementation.
- The canonical Reservation fixture uses synthetic data and remains fully offline.
- CI uses read-only repository permissions and runs formatting, lint, typecheck, tests, build, and CLI smoke verification.

---

## Planned File Map

```text
.github/workflows/ci.yml
.editorconfig
.gitignore
.npmrc
.prettierignore
prettier.config.mjs
eslint.config.mjs
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.json
tooling/tsconfig/base.json
packages/
  domain/
  diagnostics/
  redaction/
  config/
  source-loader/
  openapi/
  cli/
examples/reservation/
  openapi.yaml
  expected/normalized-summary.json
  README.md
docs/spikes/
  parser-and-validator-selection.md
```

Each package contains `package.json`, `tsconfig.json`, `src/index.ts`, focused source files, and `tests/*.test.ts`.

---

### Task 1: Initialize the workspace and CI contract

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.json`
- Create: `tooling/tsconfig/base.json`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `.prettierignore`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces stable root commands: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:integration`, and `pnpm ci:verify`.
- Sets Node.js `>=24 <27` and `packageManager: pnpm@11.24.0`.

- [ ] **Step 1: Define a failing workspace smoke check**

Create `tooling/scripts/check-workspace.mjs` that exits non-zero until all required package directories and root commands exist.

- [ ] **Step 2: Run the smoke check and verify RED**

Run: `node tooling/scripts/check-workspace.mjs`
Expected: exit `1`, reporting the first missing package or script.

- [ ] **Step 3: Add the minimal workspace configuration**

Root scripts must route package builds through Turbo and keep verification deterministic:

```json
{
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "test": "turbo run test",
    "test:integration": "turbo run test:integration",
    "workspace:check": "node tooling/scripts/check-workspace.mjs",
    "ci:verify": "pnpm workspace:check && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm test:integration"
  }
}
```

- [ ] **Step 4: Run the smoke check and verify GREEN**

Run: `node tooling/scripts/check-workspace.mjs`
Expected: `Workspace structure is valid.`

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.json tooling .github .editorconfig .gitignore .npmrc .prettierignore prettier.config.mjs eslint.config.mjs
git commit -m "chore: initialize pnpm turborepo workspace"
```

---

### Task 2: Add the domain and diagnostic contracts

**Files:**
- Create: `packages/domain/src/http-method.ts`
- Create: `packages/domain/src/source-pointer.ts`
- Create: `packages/domain/src/schema.ts`
- Create: `packages/domain/src/operation.ts`
- Create: `packages/domain/src/document.ts`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/tests/domain.test.ts`
- Create: `packages/diagnostics/src/diagnostic.ts`
- Create: `packages/diagnostics/src/codes.ts`
- Create: `packages/diagnostics/src/format.ts`
- Create: `packages/diagnostics/src/index.ts`
- Create: `packages/diagnostics/tests/diagnostics.test.ts`

**Interfaces:**
- Produces `HttpMethod`, `SourcePointer`, `NormalizedSchema`, `NormalizedOperation`, `NormalizedApiDocument`, and `Diagnostic`.
- Produces `isHttpMethod`, `escapeJsonPointerToken`, `hasDiagnosticErrors`, `sortDiagnostics`, and `formatDiagnostic`.

- [ ] **Step 1: Write failing domain tests**

```ts
expect(isHttpMethod('post')).toBe(true)
expect(isHttpMethod('trace')).toBe(true)
expect(isHttpMethod('connect')).toBe(false)
expect(escapeJsonPointerToken('a/b~c')).toBe('a~1b~0c')
```

Also construct a complete `NormalizedOperation` in the test so breaking changes to the public shape fail typecheck.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @api-schema-flow/domain test`
Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Implement the minimal immutable model**

Use readonly properties for normalized data. Operation IDs follow `operation:<lowercase-method>:<path>`; source pointers are URI plus RFC 6901 pointer.

- [ ] **Step 4: Write failing diagnostic tests**

Verify stable ordering by severity/code/location and output such as:

```text
ERROR ASF-OAS-1001 openapi.yaml#/paths: OpenAPI paths must be an object.
```

- [ ] **Step 5: Implement diagnostics and verify GREEN**

Run: `pnpm --filter @api-schema-flow/domain test && pnpm --filter @api-schema-flow/diagnostics test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/domain packages/diagnostics
git commit -m "feat(core): add normalized domain and diagnostic contracts"
```

---

### Task 3: Add redaction, versioned config, and bounded source loading

**Files:**
- Create: `packages/redaction/src/redact.ts`
- Create: `packages/redaction/src/index.ts`
- Create: `packages/redaction/tests/redact.test.ts`
- Create: `packages/config/src/project-config.ts`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/tests/project-config.test.ts`
- Create: `packages/source-loader/src/source-document.ts`
- Create: `packages/source-loader/src/index.ts`
- Create: `packages/source-loader/tests/source-document.test.ts`

**Interfaces:**
- Produces `REDACTED_VALUE`, `redactHeaders`, and `redactSecrets` without mutating input.
- Produces `ProjectConfigV1`, `projectConfigSchema`, and `parseProjectConfig`.
- Produces `SourceDocument`, `createSourceDocument`, and a default 5 MiB source-size limit.

- [ ] **Step 1: Write failing security tests**

Test nested objects, arrays, `authorization`, `cookie`, `x-api-key`, `accessToken`, `refresh_token`, and a non-secret field named `monkey` to prevent over-redaction.

- [ ] **Step 2: Verify RED, implement redaction, verify GREEN**

Run: `pnpm --filter @api-schema-flow/redaction test`
Expected after implementation: all tests pass and original input remains unchanged.

- [ ] **Step 3: Write failing config tests**

Accept only schema version `1.0`, a non-empty project name, and local file sources. Reject unknown source types with `ASF-CFG-1001` diagnostics.

- [ ] **Step 4: Implement the Zod-backed config boundary**

Keep exported TypeScript types manual and stable; Zod remains an implementation detail.

- [ ] **Step 5: Write and pass bounded source tests**

Reject empty contents and payloads over the byte limit before any parser runs.

- [ ] **Step 6: Commit**

```bash
git add packages/redaction packages/config packages/source-loader
git commit -m "feat(core): add secure input and project boundaries"
```

---

### Task 4: Implement deterministic OpenAPI normalization

**Files:**
- Create: `packages/openapi/src/openapi-like.ts`
- Create: `packages/openapi/src/version.ts`
- Create: `packages/openapi/src/normalize-schema.ts`
- Create: `packages/openapi/src/normalize-operation.ts`
- Create: `packages/openapi/src/normalize-document.ts`
- Create: `packages/openapi/src/index.ts`
- Create: `packages/openapi/tests/normalize-document.test.ts`

**Interfaces:**
- Produces `detectOpenApiVersion` and `normalizeOpenApiDocument(input, source)`.
- Returns `{ document?: NormalizedApiDocument; diagnostics: Diagnostic[] }`.
- Sorts paths, methods, response codes, tags, and component schema names for deterministic output.

- [ ] **Step 1: Write a failing normalization test using an in-memory object**

The fixture must include path-level and operation-level parameters, request body, responses, security, tags, servers, and component schemas.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @api-schema-flow/openapi test -- normalize-document`
Expected: FAIL because normalization is missing.

- [ ] **Step 3: Implement version detection and compatibility diagnostics**

- `3.0.x` → supported
- `3.1.x` → supported
- `3.2.x` → supported in compatibility mode plus `ASF-OAS-2001` warning
- any other/missing version → `ASF-OAS-1002` error

- [ ] **Step 4: Implement normalization**

Merge path and operation parameters by `(in, name)`, with the operation definition winning. Generate source pointers from the original document path, never from parser-specific objects.

- [ ] **Step 5: Verify GREEN and determinism**

Run the same normalization twice and assert deep equality.

- [ ] **Step 6: Commit**

```bash
git add packages/openapi
git commit -m "feat(openapi): normalize operations into the domain model"
```

---

### Task 5: Add the Scalar parser adapter and processing facade

**Files:**
- Create: `packages/openapi/src/parser-adapter.ts`
- Create: `packages/openapi/src/scalar-parser-adapter.ts`
- Create: `packages/openapi/src/process-openapi.ts`
- Create: `packages/openapi/tests/scalar-parser-adapter.test.ts`
- Create: `docs/spikes/parser-and-validator-selection.md`

**Interfaces:**
- Produces `OpenApiParserAdapter`, `ScalarOpenApiParserAdapter`, and `processOpenApi(source, adapter?)`.
- Parser result is `unknown` plus project diagnostics; no Scalar type is exported.

- [ ] **Step 1: Write a failing adapter contract test**

Validate a minimal OpenAPI JSON string and assert the adapter returns an object. Validate an invalid document and assert `ASF-OAS-1003` diagnostics instead of throwing raw parser errors.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @api-schema-flow/openapi test -- scalar-parser-adapter`
Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement the adapter using Scalar `validate` and `dereference`**

Map every external error to a project diagnostic and preserve the input source URI. External URL and file plugins are intentionally not enabled in M1-A.

- [ ] **Step 4: Add the processing facade**

`processOpenApi` must run parser validation first, stop normalization on parser errors, then return normalized output plus sorted diagnostics.

- [ ] **Step 5: Record the spike decision**

Document Scalar 0.29 and Zod 4 as first adapters, their exit criteria, and the rule that both stay behind project-owned interfaces.

- [ ] **Step 6: Commit**

```bash
git add packages/openapi docs/spikes/parser-and-validator-selection.md
git commit -m "feat(openapi): add Scalar parser adapter boundary"
```

---

### Task 6: Add the first CLI command

**Files:**
- Create: `packages/cli/src/validate-command.ts`
- Create: `packages/cli/src/run-cli.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/bin/schema-flow.mjs`
- Create: `packages/cli/tests/run-cli.test.ts`
- Create: `packages/cli/tests/validate-command.integration.test.ts`

**Interfaces:**
- Produces `runCli(argv, dependencies, io): Promise<number>`.
- Supports `schema-flow validate <file> [--json]`.
- Exit codes: `0` valid, `1` validation/normalization failure, `2` usage/input failure, `3` unexpected internal failure.

- [ ] **Step 1: Write failing usage and JSON-output tests**

Verify missing path exits `2`, human output contains operation count, JSON output is parseable and contains `schemaVersion: "1.0"`.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @api-schema-flow/cli test`
Expected: FAIL because CLI behavior is missing.

- [ ] **Step 3: Implement pure CLI orchestration**

Inject file reading and OpenAPI processing into `runCli`; keep process globals and Node filesystem access only in the small `.mjs` bootstrap.

- [ ] **Step 4: Add secret-safe error handling**

All unexpected values pass through redaction before reaching stderr or JSON output.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm --filter @api-schema-flow/cli test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): add schema-flow validate command"
```

---

### Task 7: Add the canonical Reservation fixture and golden tests

**Files:**
- Create: `examples/reservation/openapi.yaml`
- Create: `examples/reservation/expected/normalized-summary.json`
- Create: `examples/reservation/README.md`
- Create: `packages/openapi/tests/reservation-golden.integration.test.ts`

**Interfaces:**
- Fixture operations: `POST /auth/login`, `GET /spaces/available`, `POST /reservations`, `GET /reservations/{id}`.
- Produces a stable summary consumed by CLI smoke tests and later milestones.

- [ ] **Step 1: Write the failing golden test**

Read the YAML through the real Scalar adapter and compare title, OpenAPI version, operation IDs, methods, paths, response codes, security, and component schema names with the committed expected JSON.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @api-schema-flow/openapi test:integration`
Expected: FAIL until fixture and normalization behavior match.

- [ ] **Step 3: Add the synthetic Reservation specification and expected summary**

Use examples only; no real credentials, hostnames, personal data, or external `$ref` URLs.

- [ ] **Step 4: Verify GREEN and CLI smoke behavior**

Run:

```bash
pnpm build
node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml
node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml --json
```

Expected: exit `0`, four normalized operations, no error diagnostics.

- [ ] **Step 5: Commit**

```bash
git add examples/reservation packages/openapi/tests/reservation-golden.integration.test.ts
git commit -m "test(openapi): add reservation golden fixture"
```

---

### Task 8: Verify the complete slice and prepare the Draft PR

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/30-IMPLEMENTATION-READINESS-CHECKLIST.md` only to record implementation evidence; do not falsely mark owner-only gates approved.

**Interfaces:**
- Documents only commands and features implemented in this branch.
- Keeps all future UI, Mock, Arazzo, inference, execution, and export features labeled as roadmap work.

- [ ] **Step 1: Run full fresh verification**

```bash
pnpm install --frozen-lockfile
pnpm ci:verify
node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml
```

Expected: every command exits `0`, tests report zero failures, and CLI reports four operations.

- [ ] **Step 2: Inspect package boundaries**

Run searches that fail CI if imports contain `/src/` after an `@api-schema-flow/*` package name or if Scalar types appear outside `packages/openapi`.

- [ ] **Step 3: Update documentation with verified evidence**

Add a development-status section and exact commands. Do not claim npm publication or production readiness.

- [ ] **Step 4: Review the complete diff**

Verify no token, private API schema, generated build output, `node_modules`, or local cache is included.

- [ ] **Step 5: Push and keep the PR as Draft**

PR title:

```text
feat: establish M0 foundation and OpenAPI core slice
```

PR body must contain Scope, Architecture, Test Evidence, Security Notes, Out of Scope, and Follow-up milestones.
