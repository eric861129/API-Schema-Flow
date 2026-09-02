# Changelog

All notable changes to API Schema Flow will be documented in this file.

The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning. Before v1.0, minor releases may contain intentional public API changes, but every such change must include migration notes.

## [Unreleased]

### Added

- Initial product, architecture, security, testing, UX, CLI, mock runtime, inference, and governance specifications.
- Proposed Arazzo-first workflow model and local-first architecture.
- GitHub issue and pull request templates.
- pnpm/Turborepo/TypeScript monorepo foundation with strict package boundaries.
- Domain, diagnostics, redaction, config, source-loader, OpenAPI, Arazzo, Flow, and CLI packages.
- Scalar OpenAPI parser adapter behind a parser-independent interface.
- Deterministic OpenAPI 3.0/3.1 normalization and OpenAPI 3.2 compatibility diagnostics.
- Local `schema-flow validate <file> [--json]` command with structured output and stable exit codes.
- Offline Reservation OpenAPI fixture, golden summary, unit tests, integration tests, security tests, and CLI smoke test.
- Frozen pnpm lockfile and read-only GitHub Actions verification.
- Apache License 2.0.
- Policy-controlled local and HTTPS source acquisition with canonical path containment, DNS/IP protection, manual redirect validation, and bounded retrieval budgets.
- Deterministic multi-document OpenAPI reference graphs, source fingerprints, resolved reference pointers, Link Object normalization, conformance diagnostics, fixtures, and performance gates.
- A parser-independent Arazzo 1.1.x package with safe JSON/YAML parsing, extension and unsupported-field preservation, typed Runtime Expression and template ASTs, and deterministic normalized workflows.
- Arazzo semantic validation, explicit and implicit dependency analysis, source URI resolution, abstract operation catalogs, deterministic operation binding, and supported/preserve-only/invalid feature reports.
- CLI specification auto-detection and Arazzo validation reports for `schema-flow validate <file-or-url> [--json]`.
- Canonical Reservation Arazzo workflow and synthetic valid, preserve-only, invalid, and Runtime Expression fixtures.
- Versioned, parser-independent Flow Graph contracts for endpoint nodes, workflow-step nodes, control edges, dependency edges, structural data mappings, provenance, and accepted status.
- Deterministic graph, node, edge, and mapping identities plus graph assembly that merges equivalent declarations without discarding source evidence.
- OpenAPI Link projection into declared operation data edges.
- Arazzo projection into workflow-instance and operation-topology control, dependency, and data edges.
- Cross-standard merging that retains both Arazzo and OpenAPI Link source references for equivalent mappings.
- Parser-backed declared-flow Golden Fixtures with stable `memory://` source URIs and byte-for-byte integration checks.
- Dedicated `test:flow-fixtures` verification and Flow package boundary checks that prohibit UI, layout, server, mock, and execution runtime dependencies.

### Changed

- Project status now distinguishes the implemented M0, M1, M2-A, and M2-B slices from planned inference, visualization, execution, mock, and export capabilities.
- OpenAPI and Arazzo packages are enforced as mutually independent parser boundaries, with the Flow package as their framework-free composition layer.
- Public package declarations are checked to prevent Scalar and Zod implementation types from leaking across boundaries.
- Declared graph artifacts store structural selectors and source pointers rather than runtime values.

### Deprecated

- None.

### Removed

- Temporary lockfile bootstrap, formatting-preview, Golden-generation, probe, and development-artifact workflows used during branch development.

### Fixed

- Local file read failures now return input exit code `2` with `ASF-CLI-1002` instead of an internal-error exit.
- Parser diagnostics and diagnostic details are redacted before human or JSON CLI output.
- Root, path, and operation server source pointers retain the source level from which they were inherited.
- OpenAPI security alternatives retain their OR-group index while schemes within one requirement retain AND semantics.
- Secret-shaped schema examples, defaults, and media examples are redacted in normalized projections.
- OpenAPI 3.2 `querystring` parameters are retained in compatibility mode.
- Missing, ambiguous, unsupported, or conflicting declared flow targets produce stable `ASF-FLW-*` diagnostics instead of dangling or guessed edges.

### Security

- M1-A enables no remote URL loader or external-reference fetch plugin.
- Authorization, cookie, API key, token, password, and secret-shaped values are redacted from CLI-visible diagnostics and normalized examples.
- Declared flow projections contain mapping structure and provenance but never evaluate or persist runtime credentials.
- CI installs from a committed frozen lockfile with read-only repository permissions and Turbo telemetry disabled.
