---
name: Bug report
about: Report a reproducible problem without sharing private API data
title: "[Bug] "
labels: ["type:bug", "status:needs-reproduction"]
assignees: []
---

## Summary

Describe the observed problem and why it matters.

## Version and environment

- API Schema Flow version/commit:
- Install method:
- OS:
- Node.js:
- Browser:
- CLI or Web:
- Adapter: Fastify / MSW / Direct / Not applicable

## Reproduction

Provide the smallest synthetic or public example. Do not upload a private specification or credential.

```text
1.
2.
3.
```

Minimal sanitized OpenAPI/Arazzo/Project snippet:

```yaml
```

Command:

```bash
```

## Expected behavior

## Actual behavior

Include stable diagnostic codes when available.

```text
```

## Scope

- [ ] OpenAPI import/reference
- [ ] Arazzo parse/export
- [ ] Inference
- [ ] Canvas/Inspector
- [ ] Stateful Mock
- [ ] Workflow execution
- [ ] Trace/redaction
- [ ] CLI
- [ ] Export
- [ ] Accessibility
- [ ] Performance
- [ ] Security

## State and determinism

- Seed:
- Session selector:
- Does it reproduce after reset?
- Does it reproduce with the same input?
- Does it occur in both adapters?

## Privacy checklist

- [ ] Tokens, cookies, API keys and passwords are removed.
- [ ] Internal hosts, names and identifiers are replaced.
- [ ] Request/response examples contain only synthetic data.
- [ ] I reviewed screenshots and logs for sensitive information.

## Additional context

For a suspected vulnerability or secret leak, do not submit a public issue. Follow `SECURITY.md`.
