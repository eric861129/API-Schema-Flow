---
name: Inference quality report
about: Report a missing, incorrect, ambiguous, or poorly explained candidate edge
title: "[Inference] "
labels: ["type:inference-quality", "area:inference"]
assignees: []
---

## Result type

- [ ] False positive
- [ ] False negative
- [ ] Wrong confidence band
- [ ] Wrong field mapping
- [ ] Duplicate candidate
- [ ] Explanation/evidence is insufficient
- [ ] Ordering/regression
- [ ] Accepted/rejected decision was not preserved

## Version

- API Schema Flow version/commit:
- Inference engine version:
- Config:
- OpenAPI/Arazzo version:

## Minimal synthetic fixture

Do not submit a private API specification. Replace business names and identifiers while preserving the structure that triggers the issue.

```yaml
```

## Source and target

Source:

```text
operation:
location:
pointer:
schema:
```

Expected target:

```text
operation:
location:
pointer:
schema:
```

## Actual candidate

```json
{
  "candidateId": "",
  "score": 0,
  "confidence": "",
  "rules": [],
  "evidence": [],
  "penalties": []
}
```

## Expected behavior

Explain whether the result should be absent, lower/higher confidence, or mapped differently.

## Ambiguity

List other plausible targets. A generic field such as `id` should not be treated as unambiguous without context.

## Determinism

- Does the same input produce the same result?
- Did behavior change from a previous version?
- Are candidate IDs/order stable?

## Privacy confirmation

- [ ] The fixture is synthetic or publicly licensed.
- [ ] It contains no credentials, personal data, internal hosts, or proprietary schema names.
- [ ] Any attached report was reviewed after redaction.
