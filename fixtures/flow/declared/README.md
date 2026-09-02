# Declared Flow Golden Fixtures

This directory contains deterministic, synthetic fixtures for the M2-B declared flow graph.

- `openapi-link/` proves that a normalized OpenAPI Link becomes a declared operation data edge.
- `arazzo-reservation/` proves that OpenAPI and Arazzo produce stable operation and workflow graphs, including control, dependency, and data edges.

The integration suite parses the YAML inputs through the public OpenAPI and Arazzo APIs, uses stable `memory://` source URIs, and compares the resulting JSON byte for byte with the committed Golden Files.

Regenerate the expected files only after intentionally reviewing a graph contract change:

```bash
pnpm build
pnpm --filter @api-schema-flow/flow generate:fixtures
pnpm test:flow-fixtures
```
