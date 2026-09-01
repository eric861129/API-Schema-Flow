# Changelog

All notable changes to API Schema Flow will be documented in this file.

The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning. Before v1.0, minor releases may contain intentional public API changes, but every such change must include migration notes.

## [Unreleased]

### Added

- Initial product, architecture, security, testing, UX, CLI, mock runtime, inference, and governance specifications.
- Proposed Arazzo-first workflow model and local-first architecture.
- GitHub issue and pull request templates.
- pnpm/Turborepo/TypeScript monorepo foundation with strict package boundaries.
- Domain, diagnostics, redaction, config, source-loader, OpenAPI, and CLI packages.
- Scalar OpenAPI parser adapter behind a parser-independent interface.
- Deterministic OpenAPI 3.0/3.1 normalization and OpenAPI 3.2 compatibility diagnostics.
- Local `schema-flow validate <file> [--json]` command with structured output and stable exit codes.
- Offline Reservation OpenAPI fixture, golden summary, unit tests, integration tests, security tests, and CLI smoke test.
- Frozen pnpm lockfile and read-only GitHub Actions verification.
- Apache License 2.0.

### Changed

- Project status now distinguishes the implemented M0/M1-A slice from planned MVP capabilities.
- Public package declarations are checked to prevent Scalar and Zod implementation types from leaking across boundaries.

### Deprecated

- None.

### Removed

- Temporary lockfile bootstrap and formatting-preview workflows used during branch development.

### Fixed

- Local file read failures now return input exit code `2` with `ASF-CLI-1002` instead of an internal-error exit.
- Parser diagnostics and diagnostic details are redacted before human or JSON CLI output.
- Root, path, and operation server source pointers retain the source level from which they were inherited.
- OpenAPI security alternatives retain their OR-group index while schemes within one requirement retain AND semantics.
- Secret-shaped schema examples, defaults, and media examples are redacted in normalized projections.
- OpenAPI 3.2 `querystring` parameters are retained in compatibility mode.

### Security

- M1-A enables no remote URL loader or external-reference fetch plugin.
- Authorization, cookie, API key, token, password, and secret-shaped values are redacted from CLI-visible diagnostics and normalized examples.
- CI installs from a committed frozen lockfile with read-only repository permissions and Turbo telemetry disabled.
