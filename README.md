# API Schema Flow

> **Turn OpenAPI endpoint lists into visual, executable, and stateful API workflows.**

API Schema Flow is an open-source, local-first workbench for understanding how HTTP APIs work together. The long-term product imports OpenAPI descriptions, renders API dependencies as an interactive topology, helps users review evidence-based flow suggestions, exports standard Arazzo workflows, and runs those workflows against a stateful mock runtime.

> Project status: **pre-alpha**. The repository now contains the M0 foundation, M1 OpenAPI ingestion core, and M2-A Arazzo core. The working `validate` command auto-detects OpenAPI or Arazzo, but the visual workspace, inference, stateful mock runtime, workflow execution, and exporters remain on the roadmap. No npm package is published yet.

## What works today

The current implementation provides:

- a pnpm and Turborepo TypeScript monorepo with strict package boundaries;
- parser-independent domain, diagnostic, redaction, project-config, source-loader, OpenAPI, Arazzo, and CLI packages;
- policy-controlled local and HTTPS source loading with path, symlink, protocol, DNS/IP, redirect, timeout, size, document-count, and reference-depth limits;
- deterministic OpenAPI 3.0/3.1 normalization, OpenAPI 3.2 compatibility diagnostics, multi-file `$ref` graphs, fingerprints, and Link Objects;
- Arazzo 1.1.x JSON/YAML parsing, preservation, semantic validation, typed Runtime Expression ASTs, dependency analysis, source URI resolution, abstract operation binding, and support analysis;
- `schema-flow validate <file-or-url> [--json]`, which auto-detects OpenAPI or Arazzo;
- structured diagnostics, stable source pointers, secret-safe CLI output, and stable exit codes;
- offline OpenAPI and Arazzo Reservation fixtures with unit, integration, conformance, security, performance, and boundary tests;
- frozen-lockfile GitHub Actions verification.

## Run the current vertical slice

Requirements:

- Node.js 24
- pnpm 11

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

node packages/cli/bin/schema-flow.mjs \
  validate examples/reservation/openapi.yaml
```

Machine-readable output:

```bash
node packages/cli/bin/schema-flow.mjs \
  validate examples/reservation/openapi.yaml \
  --json
```

Validate the canonical Arazzo workflow:

```bash
node packages/cli/bin/schema-flow.mjs \
  validate examples/reservation/arazzo.yaml
```

Run the same quality gate used by CI:

```bash
pnpm ci:verify
```

A successful validation currently reports:

```text
API Schema Flow

✓ OpenAPI document loaded
✓ OpenAPI 3.1.0 detected
✓ 4 operations normalized
✓ 6 schemas discovered
✓ 0 errors
✓ 0 warnings

Validation completed successfully.
```

A successful Arazzo validation reports:

```text
API Schema Flow

✓ Arazzo document loaded
✓ Arazzo 1.1.0 detected
✓ 1 workflows normalized
✓ 4 steps inspected
Support: supported
✓ 1 sources loaded
✓ 0 errors
✓ 0 warnings

Validation completed successfully.
```

## Why this project exists

OpenAPI is excellent at describing individual operations, but teams still struggle to answer workflow-level questions:

- Which response field becomes the next request parameter?
- Which endpoints participate in login, booking, checkout, or retry flows?
- What breaks when an API field changes?
- How can frontend and QA teams exercise a realistic sequence before the backend is ready?

API Schema Flow adds an executable workflow layer without replacing OpenAPI.

## Capability status

| Capability | Current repository | MVP direction |
|---|---|---|
| OpenAPI import | Local/HTTPS YAML and JSON, policy-controlled multi-file `$ref`, deterministic fingerprints | Broader public conformance corpus and browser-specific source adapters |
| OpenAPI normalization | Stable IDs, source pointers, schemas, security, servers, Link Objects, compatibility and ambiguity diagnostics | Feed declared links into the versioned flow graph |
| Arazzo core | Arazzo 1.1.x parse/preserve, semantic validation, Runtime Expression AST, DAG analysis, URI and abstract operation resolution, support profile | Visualization, editing, export round-trip, and supported-subset execution |
| CLI | `validate <file-or-url> [--json]` auto-detects OpenAPI or Arazzo | `open`, `infer`, `mock`, `run`, and `export` planned |
| Visual topology | Design specifications and concept mockups only | React Flow nodes and edges with ELK layered layout |
| Dependency discovery | Declared OpenAPI Links and Arazzo dependencies are normalized; inference is not implemented | Manual and evidence-based inferred edges |
| Stateful mocking | Not implemented | In-memory CRUD lifecycle, deterministic seed, session isolation, reset, and snapshot |
| Workflow execution | Not implemented | Synchronous OpenAPI steps, mappings, outputs, criteria, timeout, and bounded retry |
| Live trace and export | Not implemented | Live trace, Arazzo, Mermaid, project JSON, and execution reports |
| Change impact | Post-MVP | Flow-aware OpenAPI diff and GitHub integration |

## Target experience

The intended product experience remains:

```bash
# Planned CLI UX; the npm package has not been published.
npx schema-flow open ./openapi.yaml
```

The command is expected to open a local web workspace where a developer can:

1. inspect endpoint nodes and schemas;
2. review declared and inferred dependencies;
3. accept or edit field mappings;
4. export a standards-based Arazzo workflow;
5. start an isolated stateful mock session;
6. execute the workflow and inspect a live trace.

## What makes it different

API Schema Flow does not treat every generated edge as truth. Each connection records its origin and evidence:

- **Declared** — imported from Arazzo or an OpenAPI Link Object.
- **Manual** — explicitly created or edited by a user.
- **Inferred** — proposed by deterministic matching rules with a confidence score.
- **Observed** — reserved for future evidence from traces or captured traffic.

Inferred edges remain candidates until a user accepts them.

## Architecture at a glance

```mermaid
flowchart LR
    OA[OpenAPI sources] --> ING[Parser adapter and normalizer]
    AR[Arazzo sources] --> WF[Arazzo model]
    ING --> DOM[Normalized domain model]
    WF --> DOM
    DOM --> INF[Dependency inference]
    INF --> GRAPH[Versioned flow graph]
    GRAPH --> UI[Interactive web workspace]
    GRAPH --> EXP[Arazzo and Mermaid exporters]
    GRAPH --> RUN[Workflow executor]
    RUN --> RT[Shared mock runtime]
    RT --> FAST[Fastify HTTP adapter]
    RT --> MSW[MSW interception adapter]
    RUN --> TRACE[Live trace and run report]
```

The implemented core keeps framework and parser details behind package-owned boundaries. Domain, diagnostics, redaction, config, source loading, OpenAPI normalization, Arazzo normalization, and CLI orchestration can evolve independently of the future React, Fastify, MSW, and ELK adapters. The OpenAPI and Arazzo parser packages are also kept mutually independent; the CLI is their composition layer.

## Current repository layout

```text
packages/
  domain/
  diagnostics/
  redaction/
  config/
  source-loader/
  openapi/
  arazzo/
  cli/
examples/
  reservation/
fixtures/
  openapi/
  arazzo/
docs/
  adr/
  design/
  spikes/
  superpowers/plans/
tooling/
.github/workflows/
```

See [Repository Structure](docs/22-REPOSITORY-STRUCTURE.md) for the complete planned package map and dependency rules.

## Standards baseline

The design baseline was reviewed on **2026-09-01**:

- OpenAPI Specification 3.2.0 is the latest published OAS version recorded by the project documentation.
- Arazzo Specification 1.1.0 is the latest published Arazzo version recorded by the project documentation.
- MVP execution will support a documented subset instead of claiming full Arazzo or AsyncAPI execution conformance.

See [Standards Baseline](docs/28-STANDARDS-BASELINE.md).

## Product boundaries

API Schema Flow is not intended to be:

- a full replacement for Postman or an API management gateway;
- a production traffic proxy;
- an arbitrary JavaScript execution environment;
- an automatic source of business truth from OpenAPI alone;
- a hosted collaboration platform in the MVP.

## Documentation

Start with the [Documentation Index](docs/00-DOCUMENT-INDEX.md).

Key documents:

- [Product Requirements Document](docs/02-PRD.md)
- [MVP Scope and Acceptance](docs/03-MVP-SCOPE-AND-ACCEPTANCE.md)
- [System Architecture](docs/06-SYSTEM-ARCHITECTURE.md)
- [OpenAPI Ingestion Specification](docs/08-OPENAPI-INGESTION-SPEC.md)
- [Arazzo Workflow Specification](docs/09-ARAZZO-WORKFLOW-SPEC.md)
- [CLI Specification](docs/14-CLI-SPEC.md)
- [Security Threat Model](docs/19-SECURITY-THREAT-MODEL.md)
- [Test Strategy](docs/20-TEST-STRATEGY.md)
- [M0/M1-A Implementation Plan](docs/superpowers/plans/2026-09-01-m0-m1a-foundation.md)
- [M1-B Ingestion Hardening Plan](docs/superpowers/plans/2026-09-01-m1b-ingestion-hardening.md)
- [M2-A Arazzo Core Plan](docs/superpowers/plans/2026-09-01-m2a-arazzo-core.md)

Traditional Chinese: [README.zh-TW.md](README.zh-TW.md)

## Contributing

The project uses small, reviewable pull requests, Conventional Commits, strict TypeScript, fixture-based standards tests, and package-boundary verification. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security and privacy

The project is local-first and sends no telemetry by default. Remote OpenAPI sources are acquired only through the M1-B retrieval policy: HTTPS and public-network addresses by default, canonical local roots, manual redirect validation, bounded resources, and no implicit credentials. OpenAPI and Arazzo diagnostics are redacted before reaching CLI output. See [SECURITY.md](SECURITY.md) and the [Threat Model](docs/19-SECURITY-THREAT-MODEL.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
