# M2-B Declared Flow Graph Verification

> Slice: M2-B Declared Flow Graph Foundation  
> Branch: `feat/m2b-declared-flow-graph`  
> Status: merge candidate; the final cleanup CI is recorded on Pull Request #7.

## Scope verified

- Versioned endpoint and workflow-step graph contracts.
- `control`, `dependency`, and `data` declared edges.
- OpenAPI Link projection.
- Arazzo step order, `dependsOn`, operation binding, and Runtime Expression mapping projection.
- Deterministic graph, node, edge, and mapping identities.
- Cross-standard merging that retains Arazzo and OpenAPI Link source evidence.
- Stable `ASF-FLW-*` diagnostics for missing, ambiguous, invalid, conflicting, and unsupported projections.
- Parser-backed Golden Fixtures using stable `memory://` source URIs.
- Framework-free Flow package boundaries.

## TDD evidence

### Core contracts

The first domain-contract run failed because the Flow constants and contracts were not implemented. The first projection run then failed because these public APIs did not exist:

```text
runtimeExpressionToSelector
projectOpenApiLinks
createArazzoOperationCatalogs
collectArazzoStepOutputUses
buildDeclaredFlowGraphs
```

After implementation, GitHub Actions run `33594472567` passed the complete repository gate, including 26 Flow unit tests.

### Parser-backed Golden Fixtures

GitHub Actions run `33595033569` passed build, typecheck, unit tests, and existing integration tests, then failed only because the two expected Golden JSON files did not yet exist. The Golden generator subsequently created:

```text
fixtures/flow/declared/openapi-link/expected-operation-graph.json
fixtures/flow/declared/arazzo-reservation/expected-projection.json
```

The committed Golden output is compared byte for byte against the public OpenAPI and Arazzo processing pipelines.

### Deterministic serialization format

GitHub Actions run `33595822418` demonstrated that the generated graph values were semantically identical to the committed Golden Files, but Prettier had rewritten single-value arrays and broken the byte comparison. Declared-flow Golden JSON is therefore excluded from Prettier and regenerated directly by the deterministic `JSON.stringify(value, null, 2)` serializer. This keeps the repository formatting gate and byte-for-byte graph gate independent.

## Acceptance matrix

| Requirement | Verification |
|---|---|
| Four Reservation endpoint nodes | Golden integration assertion |
| Four Reservation workflow-step nodes | Golden integration assertion |
| Three workflow control edges | Golden integration assertion |
| Three workflow dependency edges | Golden integration assertion |
| Five workflow data edges | Golden integration assertion |
| OpenAPI Link creates declared data edge | Unit and Golden integration tests |
| Every M2-B edge is `declared + accepted` | Unit assertion and Golden inspection |
| No candidate or confidence fields | Unit assertion and Golden inspection |
| Cross-standard mapping is deduplicated | Unit and Golden integration tests |
| Missing targets never create dangling edges | Projector and assembler tests |
| Stable output across repeated runs | Determinism unit and byte-for-byte Golden tests |
| No runtime secret values in graph artifacts | Golden secret-scan test |
| Flow does not depend on UI/server/runtime packages | Package-boundary gate |

## Final merge gate

The merge candidate must pass all of the following on one exact branch head:

```text
pnpm install --frozen-lockfile
pnpm workspace:check
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:flow-fixtures
pnpm boundaries:check
CLI smoke test
```

Pull Request #7 must contain no temporary formatter, generator, probe, or placeholder files before merge.
