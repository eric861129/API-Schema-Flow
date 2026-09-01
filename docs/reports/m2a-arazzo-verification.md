# M2-A Arazzo Core Verification

> Status: GitHub Actions verification pending  
> Implementation head before this report: `8e506977cd75b46a7276ca6b76b06886539e04fd`  
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

## Supplemental local evidence

The exact reviewed source tree was verified in an isolated workspace with Node.js 22.16.0. This is supplemental evidence only; the release gate is the repository CI on Node.js 24.

Commands completed successfully:

```bash
pnpm ci:verify
node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml --json
node packages/cli/bin/schema-flow.mjs validate examples/reservation/arazzo.yaml --json
git diff --check
```

Observed CLI results:

- OpenAPI 3.1.0 detected, valid, 4 operations, 6 schemas;
- Arazzo 1.1.0 detected, valid, 1 workflow, 4 steps;
- Arazzo support summary: `supported`;
- both commands returned exit code `0`.

## GitHub Actions evidence

Pending the first Node.js 24 CI run for this report commit. This section will be updated with the exact head SHA, run URL, test counts, and gate results after the run completes.

## Known M2-A limitations

M2-A does not execute workflows. AsyncAPI operations, nested workflow calls, `channelPath`, `send`/`receive`, `goto`, JSONPath, XPath, and regular-expression criteria are preserved and reported as `preserve-only`. The Web UI, dependency inference, stateful mock runtime, workflow executor, Live Trace, and exporters remain later slices.
