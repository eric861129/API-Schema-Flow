# M1-B Ingestion Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely load local and remote OpenAPI source graphs, preserve and resolve external references, normalize declared OpenAPI Links, and add conformance and performance evidence without allowing parser-controlled network access.

**Architecture:** `@api-schema-flow/source-loader` owns retrieval policy, budgets, local-path containment, URL/IP checks, redirects, timeouts, and byte-safe acquisition. `@api-schema-flow/openapi` owns syntax parsing, `$ref` graph traversal, JSON Pointer resolution, source fingerprints, OpenAPI Link normalization, and specification diagnostics. The CLI translates explicit flags into a retrieval policy and never hands arbitrary paths or URLs directly to Scalar plugins.

**Tech Stack:** TypeScript 6, Node.js 24, pnpm 11, Turborepo, Vitest 4, Scalar OpenAPI Parser 0.29.0, built-in `fetch`, `node:fs/promises`, `node:dns/promises`, `node:path`, `node:url`, Web Crypto SHA-256.

**Spec:** `docs/08-OPENAPI-INGESTION-SPEC.md`

## Global Constraints

- OpenAPI 3.0.x and 3.1.x remain supported; 3.2.x remains a compatibility profile.
- Scalar types and plugins must not leak outside `packages/openapi`.
- No remote request may occur before protocol, hostname, resolved IP, redirect, timeout, and budget policy checks pass.
- Local relative references are confined to the entry document root unless an explicit `--allow-path` root is supplied.
- Symbolic links are checked after `realpath`; path traversal outside every allowed root is rejected.
- Default URL policy is HTTPS plus public-network addresses only; HTTP and private-network access require explicit flags.
- Every acquired source is UTF-8 text and must satisfy per-document, total-byte, document-count, and reference-depth limits.
- Reference cycles are preserved and must not recurse indefinitely.
- External references are resolved to source pointers; M1-B does not inline arbitrary recursive schemas into duplicated domain objects.
- OpenAPI Link runtime expressions remain strings until the M2 Runtime Expression AST.
- Normalized output, diagnostics, reference ordering, Link ordering, and fingerprints must be deterministic.
- Secrets must be redacted before CLI output and must not enter fingerprints, diagnostics, fixtures, or project configuration.

---

### Task 1: Retrieval Policy and Source Acquisition Contracts

**Files:**
- Create: `packages/source-loader/src/source-location.ts`
- Create: `packages/source-loader/src/retrieval-policy.ts`
- Create: `packages/source-loader/src/source-acquirer.ts`
- Modify: `packages/source-loader/src/index.ts`
- Modify: `packages/diagnostics/src/codes.ts`
- Test: `packages/source-loader/tests/unit/retrieval-policy.test.ts`

**Interfaces:**
- Produces: `SourceLocation`, `SourceRetrievalPolicy`, `DEFAULT_SOURCE_RETRIEVAL_POLICY`, `SourceAcquirer`, `SourceAcquisitionContext`, `SourceAcquisitionResult`, `createSourceBudget()`.
- Produces diagnostic codes for blocked protocol/path/network and exhausted byte/document/depth/redirect/timeout budgets.

- [ ] **Step 1: Write failing policy-default and budget tests**

```ts
expect(DEFAULT_SOURCE_RETRIEVAL_POLICY).toMatchObject({
  version: 1,
  allowHttp: false,
  allowPrivateNetwork: false,
  maxDocumentBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxDocuments: 32,
  maxReferenceDepth: 16,
  maxRedirects: 3,
  timeoutMs: 10_000,
})
```

Verify that consuming a 33rd document and exceeding total bytes produce stable diagnostics rather than exceptions.

- [ ] **Step 2: Run focused tests and confirm the contracts are missing**

Run: `pnpm --filter @api-schema-flow/source-loader test -- retrieval-policy`
Expected: FAIL because policy exports do not exist.

- [ ] **Step 3: Implement immutable policy defaults and a deterministic mutable budget**

Use discriminated locations:

```ts
export type SourceLocation =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'inline'; readonly uri: string; readonly content: string; readonly mediaType?: string }
```

`SourceAcquirer.acquire(location, context)` returns `{ source?, diagnostics }`; it never throws for expected input/policy failures.

- [ ] **Step 4: Run source-loader unit tests**

Run: `pnpm --filter @api-schema-flow/source-loader test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/source-loader packages/diagnostics/src/codes.ts
git commit -m "feat(source-loader): define retrieval policy contracts"
```

### Task 2: Policy-Enforced Node Source Acquirer

**Files:**
- Create: `packages/source-loader/src/ip-policy.ts`
- Create: `packages/source-loader/src/node-source-acquirer.ts`
- Modify: `packages/source-loader/package.json`
- Modify: `packages/source-loader/src/index.ts`
- Test: `packages/source-loader/tests/unit/ip-policy.test.ts`
- Test: `packages/source-loader/tests/unit/node-source-acquirer.test.ts`

**Interfaces:**
- Consumes: Task 1 policy, budget, and acquisition contracts.
- Produces: `createNodeSourceAcquirer(dependencies?)`, `isBlockedIpAddress(address)`, and `isPathInsideRoot(candidate, root)`.

- [ ] **Step 1: Write failing IP classification tests**

Cover IPv4 loopback, RFC1918, link-local, multicast, unspecified, IPv4-mapped IPv6, IPv6 loopback, unique-local, link-local, public IPv4, and public IPv6.

- [ ] **Step 2: Write failing local-file containment tests**

Use a temporary directory and symlink. Verify that a normal relative file loads, `../` escape is rejected, and a symlink whose resolved target escapes the allowed root is rejected with `ASF-SRC-1004`.

- [ ] **Step 3: Write failing URL acquisition tests with injected DNS and fetch**

Verify HTTPS public host succeeds; HTTP is blocked by default; private resolved IP is blocked before fetch; redirects are revalidated; redirect limit, timeout, non-2xx status, invalid UTF-8, and streamed byte limit emit diagnostics.

- [ ] **Step 4: Implement local and URL acquisition**

Local acquisition uses `realpath`, `path.relative`, `readFile`, and fatal `TextDecoder`. URL acquisition uses manual redirects, `AbortController`, `dns.lookup({ all: true })`, `credentials: 'omit'`, and streamed byte accounting.

- [ ] **Step 5: Run focused and package tests**

Run:

```bash
pnpm --filter @api-schema-flow/source-loader test -- ip-policy
pnpm --filter @api-schema-flow/source-loader test -- node-source-acquirer
pnpm --filter @api-schema-flow/source-loader test
```

Expected: PASS without public network access.

- [ ] **Step 6: Commit**

```bash
git add packages/source-loader
git commit -m "feat(source-loader): enforce file and URL retrieval policy"
```

### Task 3: OpenAPI Source Graph, Reference Resolution, and Fingerprint

**Files:**
- Create: `packages/openapi/src/parse-structured-document.ts`
- Create: `packages/openapi/src/json-pointer.ts`
- Create: `packages/openapi/src/reference-graph.ts`
- Create: `packages/openapi/src/fingerprint.ts`
- Modify: `packages/openapi/src/process-openapi.ts`
- Modify: `packages/openapi/src/index.ts`
- Modify: `packages/domain/src/document.ts`
- Modify: `packages/domain/src/schema.ts`
- Test: `packages/openapi/tests/unit/json-pointer.test.ts`
- Test: `packages/openapi/tests/unit/reference-graph.test.ts`
- Test: `packages/openapi/tests/integration/multi-file-reference.integration.test.ts`

**Interfaces:**
- Consumes: `SourceAcquirer`, `SourceLocation`, retrieval policy and budget.
- Produces: `OpenApiSourceGraph`, `OpenApiSourceGraphDocument`, `OpenApiReference`, `loadOpenApiSourceGraph()`, `processOpenApiLocation()`.
- Extends `NormalizedApiDocument` with `fingerprint`, `sourceCount`, and `references` summary.
- Extends `NormalizedSchema` with optional `resolvedRef: SourcePointer`.

- [ ] **Step 1: Write failing JSON Pointer tests**

Test `~0`, `~1`, empty fragment, arrays, missing segments, and invalid pointer syntax. Resolution must return a result object and never throw for user input.

- [ ] **Step 2: Write failing graph tests**

Use an injected in-memory acquirer. Verify internal references, one relative external document, missing target pointer, blocked acquisition diagnostic propagation, document cycles, reference-depth limit, deterministic document/reference ordering, and no duplicate acquisition.

- [ ] **Step 3: Implement safe syntax parsing**

Wrap Scalar `normalize()` inside `packages/openapi`; reject non-object results with stable diagnostics. Parser-specific return types remain private to the package.

- [ ] **Step 4: Implement recursive graph loading**

Walk parsed objects for `$ref` keys, resolve document URIs relative to the declaring source, acquire only external document parts, verify target pointers, and retain usage and definition pointers.

- [ ] **Step 5: Implement deterministic SHA-256 fingerprint**

Canonical input is sorted by source URI and includes each source byte length and exact UTF-8 contents. Use `globalThis.crypto.subtle.digest('SHA-256', ...)` and lowercase hexadecimal output.

- [ ] **Step 6: Wire graph data into normalization**

`processOpenApiLocation()` loads the graph, validates the entry document with Scalar, normalizes it with a reference resolver, attaches fingerprint/source count, and merges sorted diagnostics. Existing `processOpenApi(source)` remains source-compatible by wrapping a single inline source.

- [ ] **Step 7: Add a real multi-file fixture test**

The entry YAML references `./components.yaml#/components/schemas/Reservation`; assert `resolvedRef` points to the canonical component document URI and pointer, and repeated processing returns identical fingerprint and normalized output.

- [ ] **Step 8: Run OpenAPI tests**

Run: `pnpm --filter @api-schema-flow/openapi test && pnpm --filter @api-schema-flow/openapi test:integration`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/openapi packages/domain
git commit -m "feat(openapi): load policy-controlled reference graphs"
```

### Task 4: OpenAPI Link and Conformance Normalization

**Files:**
- Create: `packages/domain/src/link.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/operation.ts`
- Create: `packages/openapi/src/normalize-link.ts`
- Modify: `packages/openapi/src/normalize-operation.ts`
- Modify: `packages/openapi/src/normalize-document.ts`
- Modify: `packages/diagnostics/src/codes.ts`
- Test: `packages/openapi/tests/unit/normalize-link.test.ts`
- Test: `packages/openapi/tests/unit/normalize-document.test.ts`

**Interfaces:**
- Produces: `NormalizedLink`, `NormalizedLinkTarget`, and `NormalizedLinkMapping`.
- `NormalizedResponse.links` contains deterministic declared Links.
- `NormalizedLink.resolvedOperationKey` is populated only when `operationRef` or unique `operationId` resolves unambiguously.

- [ ] **Step 1: Write failing Link normalization tests**

Cover an internal `operationRef`, a unique `operationId`, parameter runtime-expression mappings, requestBody preservation, target-not-found, and duplicate-operationId ambiguity.

- [ ] **Step 2: Write failing conformance tests**

Verify duplicate `operationId` retains every operation and emits `ASF-OAS-1005`; header parameter names merge case-insensitively; `query` plus `querystring` with the same name emits `ASF-OAS-2002`; path parameters remain required.

- [ ] **Step 3: Add domain Link contracts**

```ts
export interface NormalizedLink {
  readonly name: string
  readonly description?: string
  readonly target: NormalizedLinkTarget
  readonly resolvedOperationKey?: string
  readonly parameters: readonly NormalizedLinkMapping[]
  readonly requestBody?: unknown
  readonly source: SourcePointer
}
```

Runtime expressions remain opaque strings in M1-B.

- [ ] **Step 4: Normalize and resolve Links after operation collection**

Prefer `operationRef`; use `operationId` only when unique. Preserve unresolved Links and emit deterministic diagnostics rather than dropping them.

- [ ] **Step 5: Fix parameter merge semantics and duplicate operation IDs**

Header merge keys lowercase the name. Query and querystring remain distinct but generate a conflict warning for equal names.

- [ ] **Step 6: Run domain and OpenAPI tests**

Run:

```bash
pnpm --filter @api-schema-flow/domain test
pnpm --filter @api-schema-flow/openapi test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/domain packages/openapi packages/diagnostics
git commit -m "feat(openapi): normalize declared links and conformance diagnostics"
```

### Task 5: Policy-Aware CLI Validation

**Files:**
- Create: `packages/cli/src/validate-options.ts`
- Modify: `packages/cli/src/run-cli.ts`
- Modify: `packages/cli/src/validate-command.ts`
- Modify: `packages/cli/bin/schema-flow.mjs`
- Modify: `packages/cli/package.json`
- Test: `packages/cli/tests/unit/validate-options.test.ts`
- Test: `packages/cli/tests/unit/run-cli.test.ts`
- Test: `packages/cli/tests/integration/validate-command.integration.test.ts`

**Interfaces:**
- Produces parsed options for `--json`, repeatable `--allow-path`, `--allow-http`, `--allow-private-network`, `--max-documents`, `--max-total-bytes`, and `--max-ref-depth`.
- CLI dependency injection exposes `processLocation(location, policy)` for unit tests.

- [ ] **Step 1: Write failing option parser tests**

Test one file/URL positional argument, repeatable allowed roots, boolean flags, positive integer budgets, unknown flags, missing flag values, and duplicate scalar flags.

- [ ] **Step 2: Implement explicit CLI parsing**

Usage becomes:

```text
schema-flow validate <file-or-url> [--json] [--allow-path <dir>] [--allow-http] [--allow-private-network] [--max-documents <n>] [--max-total-bytes <n>] [--max-ref-depth <n>]
```

No permissive fallback is allowed.

- [ ] **Step 3: Refactor validate orchestration**

Convert the target into a file or URL location, derive the default file root from the entry path, merge explicit roots, call the Node acquirer plus `processOpenApiLocation`, sanitize diagnostics, and include `fingerprint`, `sourceCount`, and `referenceCount` in JSON output.

- [ ] **Step 4: Add CLI integration tests**

Validate the multi-file fixture successfully, reject a traversal fixture, and reject a private-network URL before the injected fetch function is called.

- [ ] **Step 5: Run CLI tests**

Run: `pnpm --filter @api-schema-flow/cli test && pnpm --filter @api-schema-flow/cli test:integration`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): expose policy-controlled OpenAPI validation"
```

### Task 6: Fixture Matrix and Performance Gate

**Files:**
- Create: `fixtures/openapi/refs/multi-file/openapi.yaml`
- Create: `fixtures/openapi/refs/multi-file/components.yaml`
- Create: `fixtures/openapi/links/declared-link.yaml`
- Create: `fixtures/openapi/invalid/duplicate-operation-id.yaml`
- Create: `fixtures/openapi/security/private-network-ref.yaml`
- Create: `fixtures/openapi/valid/header-override.yaml`
- Create: `fixtures/openapi/fixtures.yaml`
- Create: `tooling/scripts/check-openapi-fixtures.mjs`
- Create: `tooling/scripts/benchmark-openapi.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces `pnpm fixtures:openapi` and `pnpm benchmark:openapi`.
- Fixture metadata records ID, purpose, source license, expected diagnostics, and expected counts.

- [ ] **Step 1: Add synthetic CC0 fixture metadata and files**

Fixtures contain no real credentials or proprietary API definitions.

- [ ] **Step 2: Implement fixture runner**

Load metadata, process each fixture with the declared policy, compare exact expected diagnostic codes and normalized counts, and print a stable summary.

- [ ] **Step 3: Implement deterministic 500-operation benchmark**

Generate the document in memory, process it twice, require identical fingerprints and operation IDs, and fail when either run exceeds 5,000 ms on the Node 24 CI runner.

- [ ] **Step 4: Add fixture and benchmark gates to CI**

Run them after unit/integration verification and before the CLI smoke test.

- [ ] **Step 5: Run the full quality gate**

Run: `pnpm ci:verify && pnpm fixtures:openapi && pnpm benchmark:openapi`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add fixtures tooling package.json .github/workflows/ci.yml
git commit -m "test(openapi): add conformance fixtures and performance gate"
```

### Task 7: Documentation, Compatibility Notes, and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/08-OPENAPI-INGESTION-SPEC.md`
- Create: `docs/reports/m1b-ingestion-verification.md`

**Interfaces:**
- Documents actual flags, implemented policy defaults, Link support, reference-resolution limits, and benchmark evidence without claiming M2 capabilities.

- [ ] **Step 1: Update public documentation**

Describe local multi-file loading, HTTPS URL loading, opt-in flags, Link preservation/resolution, fingerprints, diagnostics, and remaining limitations. Do not claim arbitrary dereference, Arazzo conversion, browser loader, or full OpenAPI 3.2 execution.

- [ ] **Step 2: Record verification evidence**

Include commit SHA placeholder only after the implementation commit exists; record exact commands, test totals, fixture totals, benchmark input size, and CI run link in the Draft PR body instead of inventing results.

- [ ] **Step 3: Run final verification from a clean install**

Run:

```bash
pnpm install --frozen-lockfile
pnpm ci:verify
pnpm fixtures:openapi
pnpm benchmark:openapi
node packages/cli/bin/schema-flow.mjs validate fixtures/openapi/refs/multi-file/openapi.yaml --json
```

Expected: all commands succeed; JSON reports two sources, one resolved external reference, a stable fingerprint, and no error diagnostics.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md README.zh-TW.md CHANGELOG.md docs
git commit -m "docs: publish M1-B ingestion capabilities and evidence"
```

- [ ] **Step 5: Update the Draft PR**

Add the verified commit SHA, CI run, test totals, fixture summary, benchmark result, security notes, known limitations, and M1-C follow-up scope. Keep the PR Draft until owner review.
