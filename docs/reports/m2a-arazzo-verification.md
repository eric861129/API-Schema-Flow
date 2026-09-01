# M2-A Arazzo Core Verification

> Status: verified  
> Verified implementation head: `d29a45a488b3bfaa9e4f9fcc201b34d45f47053b`  
> Verification date: 2026-09-01

## Delivered scope

M2-A adds the parser-independent Arazzo 1.1 core:

- safe JSON and YAML parsing;
- normalized workflow preservation;
- typed Runtime Expression and template AST;
- semantic validation and deterministic dependency analysis;
- support classification as `supported`, `preserve-only`, or `invalid`;
- `$self` and Source Description URI resolution;
- abstract operation-catalog binding without an OpenAPI package dependency;
- CLI auto-detection and validation reports for OpenAPI and Arazzo;
- canonical, preserve-only, invalid, and Runtime Expression fixtures;
- package-boundary enforcement between the OpenAPI and Arazzo cores.

## GitHub Actions evidence

Official verification ran through the repository's existing read-only CI workflow:

- Run: [GitHub Actions #122](https://github.com/eric861129/API-Schema-Flow/actions/runs/33521934433)
- Job: `Verify`
- Result: `success`
- Runner: Ubuntu 24.04
- Node.js: 24.19.0
- pnpm: 11.24.0
- Frozen lockfile installation: passed
- Workspace structure and package boundaries: passed
- Prettier and ESLint: passed
- Build and TypeScript typecheck: passed
- Unit tests: 147 passed
- Integration tests: 6 passed
- Total automated tests: 153 passed
- OpenAPI CLI smoke test: passed

Package-level test evidence:

| Package / layer | Unit tests | Integration tests |
|---|---:|---:|
| Arazzo | 62 | 2 |
| OpenAPI | 21 | 2 |
| CLI | 23 | 2 |
| Source Loader | 27 | 0 |
| Domain | 4 | 0 |
| Diagnostics | 3 | 0 |
| Redaction | 3 | 0 |
| Config | 4 | 0 |
| **Total** | **147** | **6** |

The official OpenAPI smoke test reported:

```text
OpenAPI 3.1.0 detected
4 operations normalized
6 schemas discovered
1 source loaded
9 references inspected
0 errors
0 warnings
```

## Supplemental Arazzo CLI evidence

The exact reviewed source tree was also verified in an isolated workspace with Node.js 22.16.0. This is supplemental evidence; the release gate remains the Node.js 24 GitHub Actions run above.

Commands completed successfully:

```bash
pnpm ci:verify
node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml --json
node packages/cli/bin/schema-flow.mjs validate examples/reservation/arazzo.yaml --json
git diff --check
```

Observed Arazzo result:

```text
Arazzo 1.1.0 detected
1 workflow normalized
4 steps normalized
support: supported
0 errors
```

Both OpenAPI and Arazzo validation commands returned exit code `0`.

## Known M2-A limitations

M2-A does not execute workflows. AsyncAPI operations, nested workflow calls, `channelPath`, `send`/`receive`, `goto`, JSONPath, XPath, and regular-expression criteria are preserved and reported as `preserve-only`. The Web UI, dependency inference, stateful mock runtime, workflow executor, Live Trace, and exporters remain later slices.
