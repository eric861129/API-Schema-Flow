# Parser and runtime validator selection

> Status: Accepted for M0/M1-A  
> Date: 2026-09-01

## Decision

- Use `@scalar/openapi-parser` 0.29 as the first OpenAPI parser adapter.
- Use Zod 4 as the first runtime validator for project configuration.
- Keep both libraries behind project-owned interfaces and normalized models.

## Evidence

Scalar 0.29 accepts JSON strings, YAML strings, objects, and virtual filesystems. Its `validate` operation performs schema and semantic validation, resolves references without enabling remote/file plugins by default, and returns a resolved schema plus structured errors. This supports the local-file-only M1-A boundary.

Zod 4 provides runtime validation and stable issue objects for mapping into API Schema Flow diagnostics. Exported configuration types remain handwritten so Zod does not become the public data contract.

## Exit criteria

Re-evaluate either adapter when one of the following is observed in Golden Fixtures or browser spikes:

- Source pointers cannot be reconstructed accurately enough for diagnostics.
- Reference resolution cannot be bounded by the security policy.
- OpenAPI 3.0, 3.1, or compatibility-mode 3.2 semantics are lost.
- Browser or Node bundle cost exceeds the documented budget.
- Recursive configuration schemas or JSON Schema export cannot be supported.
- License, maintenance, or supply-chain risk changes materially.

No Scalar or Zod-specific type may cross its package boundary.
