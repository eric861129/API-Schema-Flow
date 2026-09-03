# M2-D Review Decisions and Deterministic Arazzo Export Verification

> Slice: M2-D Review Decisions and Deterministic Arazzo Export  
> Branch: `feat/m2d-review-export`  
> Local implementation commit: `874efcaf23eb08fdc94562808832cc4dd5bc8b84`  
> Verification date: 2026-09-03

## Scope verified

- Immutable `accept`, `reject`, and `edit` review decisions.
- Deterministic decision identity that excludes timestamps.
- Revision supersession, same-revision conflict handling, stale decisions, and orphaned decisions.
- Accepted inferred and manual operation-graph materialization without mutating declared edges.
- Parse-boundary validation for manually authored edges and mappings.
- Explicit workflow plans; the exporter does not infer business step order.
- Accepted mapping projection to Arazzo outputs, parameters, request bodies, and `dependsOn`.
- Canonical Arazzo 1.1 YAML and JSON serialization.
- SHA-256 content hashes over the exact exported bytes.
- Generated-document validation through the existing Arazzo parser and semantic validator.
- Safe CLI output, no-overwrite behavior, and temporary-file replacement for explicit `--force`.
- Candidate identity stability across equivalent source locations and internal Component Schema references.

## Decision fixture outcomes

The canonical Reservation fixture produced a valid accepted-only graph with these outcomes:

| Outcome | Count |
|---|---:|
| Applied | 3 |
| Rejected | 1 |
| Stale | 1 |
| Orphaned | 1 |
| Superseded | 1 |
| Already present | 0 |

The inference stage indexed 18 source fields and 12 target fields, evaluated 18 plausible pairs, blocked 6 pairs, emitted 8 candidates, and completed without truncation. The final reviewed graph contains 3 accepted data edges.

## Deterministic export evidence

| Artifact | SHA-256 |
|---|---|
| `expected-workflow.arazzo.yaml` | `16f3dcf51ad299db687bac61cf5f6c4ad5ee9e22a52d1daa69c87a767b2d527d` |
| `expected-workflow.arazzo.json` | `e1aa6e35a1b6298bccca0a66c13e9b30d137c2bddefef083d372783a618579d7` |

CLI-generated YAML and JSON were compared byte-for-byte with the committed Golden files. Both commands exited with code `0`. The YAML and JSON were then parsed through `processArazzoSource` by the integration suite.

## Repository verification

The following commands passed on the recorded implementation tree:

```text
pnpm install --frozen-lockfile --offline --lockfile-only
npm run ci:verify
npm --prefix packages/flow run test:integration
npm --prefix packages/inference run test:integration
npm --prefix packages/review test
npm --prefix packages/exporter-arazzo test
npm --prefix packages/exporter-arazzo run test:integration
git diff --check
```

`ci:verify` passed:

- workspace structure;
- Prettier;
- ESLint;
- TypeScript build for 12 packages;
- TypeScript typecheck;
- all unit suites;
- all integration suites;
- package-boundary and public-declaration checks.

Test totals reported by the full repository run:

| Suite class | Tests |
|---|---:|
| Unit | 252 |
| Integration | 22 |
| Total | 274 |

Focused M2-D totals:

| Package | Unit | Integration |
|---|---:|---:|
| Review | 18 | 0 |
| Arazzo Exporter | 13 | 6 |
| CLI | 41 | 7 |

The CLI counts include existing validation and inference coverage as well as the new review/export vertical slice.

## CLI smoke commands

```bash
node packages/cli/bin/schema-flow.mjs review \
  fixtures/review/reservation/openapi.yaml \
  --decisions fixtures/review/reservation/decision-set.json \
  --json
```

```bash
node packages/cli/bin/schema-flow.mjs export-arazzo \
  fixtures/review/reservation/openapi.yaml \
  --decisions fixtures/review/reservation/decision-set.json \
  --workflow fixtures/review/reservation/workflow-plan.json \
  --format yaml
```

```bash
node packages/cli/bin/schema-flow.mjs export-arazzo \
  fixtures/review/reservation/openapi.yaml \
  --decisions fixtures/review/reservation/decision-set.json \
  --workflow fixtures/review/reservation/workflow-plan.json \
  --format json
```

The expected stale and orphaned decisions remain warnings and do not invalidate the artifact.

## Security checks

- Candidate, rejected, stale, orphaned, superseded, conflicting, and invalid review records create no exported edge.
- Literal selectors and unsupported transforms are blocked from the M2-D export profile.
- Credential-bearing Source Description URLs are rejected.
- Credential-shaped generated values are blocked before artifact return.
- Golden reviewed graphs and exported Arazzo artifacts contain neither `synthetic-password` nor `synthetic-jwt-token`.
- Diagnostics are passed through the established CLI redaction path.
- Existing output files are not overwritten unless the caller explicitly supplies `--force`.

## Additional issue found during final review

A malformed `manualEdges` entry in decision JSON could previously pass the shallow decision-set parser and fail later during graph materialization. A failing regression test was added first; the parser now validates selector, target, alias, transform, source-pointer, review-metadata, and edge structure and returns `ASF-REV-1006` instead of an internal exception.

## Merge gate

The published PR head must run the normal GitHub Actions CI successfully before merge. The exact remote commit and Actions run are recorded in the Pull Request because adding those self-referential values to this report would create another commit and invalidate them.
