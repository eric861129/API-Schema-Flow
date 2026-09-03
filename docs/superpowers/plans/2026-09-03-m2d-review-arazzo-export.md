# M2-D Review Decisions and Deterministic Arazzo Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist explicit inference review decisions, materialize a deterministic accepted operation graph, and export an explicitly ordered accepted subset as parser-valid Arazzo 1.1 JSON or YAML.

**Architecture:** `@api-schema-flow/domain` owns serializable review contracts and optional edge-review metadata. A framework-free `@api-schema-flow/review` package validates decisions, resolves supersession and staleness, and materializes accepted inferred/manual edges without changing declared edges. A separate `@api-schema-flow/exporter-arazzo` package validates explicit workflow plans, projects accepted mappings, serializes deterministically, and validates its output through the existing Arazzo processor. CLI remains the composition boundary.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript strict mode, Vitest, Turborepo, YAML 2.9, existing Domain/Diagnostics/OpenAPI/Arazzo/Flow/Inference packages.

**Spec:** `docs/superpowers/specs/2026-09-03-m2d-review-arazzo-export-design.md`

## Global Constraints

- No inferred relationship becomes authoritative without an explicit valid decision.
- Changed candidate fingerprints or rule-set versions are stale and never auto-migrated.
- `accept` creates `inferred + accepted`; `edit` creates `manual + accepted`; `reject` creates no edge.
- Declared edges remain authoritative and are never mutated.
- Export requires an explicit ordered workflow plan and never guesses business sequence.
- Candidate/rejected/stale/orphaned/superseded decisions never enter Arazzo output.
- Generated Arazzo targets `1.1.0`, is deterministic, secret-safe, and must pass `processArazzoSource`.
- Every production behavior follows Red → Green → Refactor.

---

### Task 1: Domain Review Contracts and Diagnostics

**Files:**
- Create: `packages/domain/src/review-decision.ts`
- Create: `packages/domain/tests/unit/review-decision-contract.test.ts`
- Modify: `packages/domain/src/flow-edge.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/diagnostics/src/codes.ts`

**Interfaces:**
- Produces `REVIEW_DECISION_SCHEMA_VERSION`, `ReviewDecision`, `ReviewDecisionSet`, `ReviewDecisionOutcome`, `ReviewDecisionOutcomeState`, and `FlowEdgeReviewMetadata`.

- [ ] Write a failing unit test proving schema version `1.0`, JSON serializability, and optional review metadata.
- [ ] Run `pnpm --filter @api-schema-flow/domain test -- review-decision-contract.test.ts`; verify failure is caused by missing exports.
- [ ] Implement the exact contracts from the design and add `review?: FlowEdgeReviewMetadata` to `FlowEdge`.
- [ ] Add `ASF-REV-1001..1008` and `ASF-EXP-1001..1008` diagnostic constants.
- [ ] Run Domain/Diagnostics unit tests and Domain typecheck.
- [ ] Commit as `feat(domain): add review decision contracts`.

### Task 2: Review Package, Stable Identity, and Parsing

**Files:**
- Create: `packages/review/package.json`
- Create: `packages/review/tsconfig.json`
- Create: `packages/review/src/contracts.ts`
- Create: `packages/review/src/canonical.ts`
- Create: `packages/review/src/parse-decision-set.ts`
- Create: `packages/review/src/index.ts`
- Create: `packages/review/tests/unit/canonical.test.ts`
- Create: `packages/review/tests/unit/parse-decision-set.test.ts`
- Modify: `tooling/scripts/check-workspace.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
```ts
createReviewDecisionId(input: Omit<ReviewDecision, 'id' | 'decidedAt'>): string
canonicalizeDecisionSet(input: ReviewDecisionSet): ReviewDecisionSet
parseReviewDecisionSet(input: unknown): ParseReviewDecisionSetResult
```

- [ ] Write failing identity tests: timestamps do not change identity; edited mapping semantics do.
- [ ] Scaffold the package and implement canonical FNV-1a identity over semantic fields only.
- [ ] Write failing parser tests for wrong schema version, bad timestamp, edit-without-mapping, accept-with-mapping, and ID mismatch.
- [ ] Implement structural validation without Zod/parser-specific dependencies; never echo sensitive mapping values in diagnostics.
- [ ] Verify build, typecheck, tests, workspace check, and frozen lockfile compatibility.
- [ ] Commit as `feat(review): validate canonical decision sets`.

### Task 3: Supersession, Staleness, and Accepted Graph Materialization

**Files:**
- Create: `packages/review/src/decision-resolution.ts`
- Create: `packages/review/src/materialize-reviewed-graph.ts`
- Create: `packages/review/tests/unit/decision-resolution.test.ts`
- Create: `packages/review/tests/unit/materialize-reviewed-graph.test.ts`
- Modify: `packages/review/src/contracts.ts`
- Modify: `packages/review/src/index.ts`

**Interfaces:**
```ts
resolveReviewDecisions(input): ResolveReviewDecisionsResult
materializeReviewedOperationGraph(input: MaterializeReviewedGraphInput): MaterializeReviewedGraphResult
```

- [ ] Write failing tests for highest-revision selection, duplicate dedupe, same-revision conflict, stale fingerprint/rule-set, and orphaned candidate.
- [ ] Implement deterministic resolution and outcomes.
- [ ] Write failing materialization tests for accept, reject, edit, manual edges, declared-equivalent suppression, missing nodes, deterministic ordering, and accepted-only output.
- [ ] Implement accepted inferred/manual edges with stable IDs and derivation metadata while preserving declared edges byte-for-byte.
- [ ] Verify all Review tests, build, and typecheck.
- [ ] Commit as `feat(review): materialize reviewed operation graphs`.

### Task 4: Arazzo Exporter Package and Explicit Workflow Plan

**Files:**
- Create: `packages/exporter-arazzo/package.json`
- Create: `packages/exporter-arazzo/tsconfig.json`
- Create: `packages/exporter-arazzo/src/contracts.ts`
- Create: `packages/exporter-arazzo/src/validate-workflow-plan.ts`
- Create: `packages/exporter-arazzo/src/operation-binding.ts`
- Create: `packages/exporter-arazzo/src/index.ts`
- Create: `packages/exporter-arazzo/tests/unit/validate-workflow-plan.test.ts`
- Modify: `tooling/scripts/check-workspace.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
```ts
validateArazzoWorkflowPlan(input): ValidateArazzoWorkflowPlanResult
bindWorkflowPlanOperations(input): BindWorkflowPlanOperationsResult
```

- [ ] Write failing tests for missing/duplicate IDs, missing endpoint nodes, missing source descriptions, ambiguous operation binding, empty plans, and explicit order preservation.
- [ ] Scaffold exporter package and implement validation/binding.
- [ ] Confirm exporter does not reorder or infer steps.
- [ ] Verify package tests, build, typecheck, workspace check, and frozen install.
- [ ] Commit as `feat(export): validate explicit Arazzo workflow plans`.

### Task 5: Accepted Mapping Projection

**Files:**
- Create: `packages/exporter-arazzo/src/output-projector.ts`
- Create: `packages/exporter-arazzo/src/target-projector.ts`
- Create: `packages/exporter-arazzo/src/mapping-projector.ts`
- Create: `packages/exporter-arazzo/tests/unit/mapping-projector.test.ts`

**Interfaces:**
```ts
projectAcceptedMappings(input: ProjectAcceptedMappingsInput): ProjectAcceptedMappingsResult
```

- [ ] Write failing tests for response-body/header/status outputs, path/query/header/cookie parameters, request-body object pointers, `dependsOn`, and output deduplication.
- [ ] Add negative tests for querystring, request-derived/workflow-input/literal selectors, numeric request-body segments, unsupported transforms, conflicts, and forward references.
- [ ] Implement the minimum supported subset and structural rewriting of one-expression templates.
- [ ] Verify unit tests, build, and typecheck.
- [ ] Commit as `feat(export): project accepted mappings to Arazzo`.

### Task 6: Canonical Serialization, Self-validation, and Golden Fixtures

**Files:**
- Create: `packages/exporter-arazzo/src/document-builder.ts`
- Create: `packages/exporter-arazzo/src/serialize.ts`
- Create: `packages/exporter-arazzo/src/export-arazzo.ts`
- Create: `packages/exporter-arazzo/tests/integration/export-arazzo.integration.test.ts`
- Create: `fixtures/review/reservation/openapi.yaml`
- Create: `fixtures/review/reservation/decision-set.json`
- Create: `fixtures/review/reservation/workflow-plan.json`
- Create: `fixtures/review/reservation/expected-reviewed-graph.json`
- Create: `fixtures/review/reservation/expected-workflow.arazzo.yaml`
- Create: `fixtures/review/reservation/expected-workflow.arazzo.json`
- Modify: `package.json`

**Interfaces:**
```ts
exportArazzo(input: ExportArazzoInput): Promise<ArazzoExportArtifact>
```

- [ ] Write failing integration tests for YAML/JSON byte identity, SHA-256 hashes, parser-valid Arazzo 1.1, reordered-input determinism, and secret absence.
- [ ] Build canonical document fields and operation references; serialize YAML/JSON with stable ordering and trailing newline.
- [ ] Run `processArazzoSource` against exact generated bytes; map failures to `ASF-EXP-1008`.
- [ ] Generate, inspect, and commit Golden artifacts; remove any temporary generator.
- [ ] Add `test:review-export-fixtures` and verify it passes.
- [ ] Commit as `test(export): add deterministic Arazzo Golden fixtures`.

### Task 7: CLI `review`

**Files:**
- Create: `packages/cli/src/review-options.ts`
- Create: `packages/cli/src/review-command.ts`
- Create: `packages/cli/tests/unit/review-options.test.ts`
- Create: `packages/cli/tests/unit/review-command.test.ts`
- Modify: `packages/cli/src/run-cli.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/package.json`

- [ ] Write failing parser tests for required `--decisions`, JSON flag, retrieval policy, unknown flags, and missing values.
- [ ] Implement option parsing using existing CLI conventions.
- [ ] Write failing composition tests for OpenAPI load → declared graph → inference → decision parse → review materialization.
- [ ] Implement stable human/JSON reports, exit code `2` for input I/O/JSON errors, and `1` for semantic review errors.
- [ ] Verify CLI tests and typecheck.
- [ ] Commit as `feat(cli): add review decision command`.

### Task 8: CLI `export-arazzo` and Safe File Output

**Files:**
- Create: `packages/cli/src/export-arazzo-options.ts`
- Create: `packages/cli/src/export-arazzo-command.ts`
- Create: `packages/cli/tests/unit/export-arazzo-options.test.ts`
- Create: `packages/cli/tests/unit/export-arazzo-command.test.ts`
- Create: `packages/cli/tests/integration/review-export-command.integration.test.ts`
- Modify: `packages/cli/src/run-cli.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] Write failing option tests for required decision/workflow files, format validation, output/force rules, and unknown options.
- [ ] Implement parsing; YAML is default and `--force` is invalid without `--output`.
- [ ] Write failing tests for stdout bytes, file output, no-overwrite, forced overwrite, invalid plan, I/O errors, and secret/candidate exclusion.
- [ ] Implement atomic valid-artifact-only output using exclusive create without force.
- [ ] Verify CLI unit/integration tests and exact Golden equality.
- [ ] Commit as `feat(cli): export reviewed graphs as Arazzo`.

### Task 9: Boundaries, Documentation, and Exact Verification

**Files:**
- Modify: `tooling/scripts/check-boundaries.mjs`
- Modify: `README.md`
- Modify: `README.zh-TW.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/00-DOCUMENT-INDEX.md`
- Create: `docs/reports/m2d-review-arazzo-export-verification.md`
- Modify: `package.json`

- [ ] Add a temporary forbidden import and verify the new Review/Exporter boundary rule fails.
- [ ] Remove the violation and verify boundary checks pass.
- [ ] Document commands, safety model, package map, limitations, spec, plan, and verification report.
- [ ] Add explicit `test:review` and `test:export-arazzo` root scripts.
- [ ] Run formatting and review generated artifacts for unintended changes.
- [ ] Run frozen install, workspace check, format, lint, build, typecheck, all unit/integration suites, M2-B Golden, M2-C benchmark/performance, M2-D fixtures, boundaries, and `git diff --check`.
- [ ] Smoke-test `schema-flow review ... --json` and `schema-flow export-arazzo ...`; require exit `0` and exact Golden output.
- [ ] Push exact head, require GitHub Actions success, then record branch SHA, test counts, hashes, CLI exits, and run URL in the verification report.
- [ ] Commit as `docs: complete M2-D review and export verification`.
