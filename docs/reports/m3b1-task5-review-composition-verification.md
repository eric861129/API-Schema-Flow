# M3-B1 Task 5 Review Composition Verification

## Scope

Task 5 adds the browser composition layer between in-memory Review intents, the browser-safe Review core, and the Web Review view models.

Implemented modules:

- `apps/web/src/review/decision-factory.ts`
- `apps/web/src/review/review-engine.ts`
- `apps/web/src/review/review-workspace-adapter.ts`
- focused unit and integration-style Web tests for decisions, materialization, schema resolution, state priority, and performance

## TDD evidence

The Task 5 delivery gate first applied only the new tests and verified that they failed because the Decision Factory, Review Engine, and Workspace Adapter modules did not exist. Production code was applied only after that RED result was confirmed.

## Behavioral verification

The GREEN gate verifies:

- deterministic baseline revision derivation;
- Accept and Reject intent conversion to valid Domain `ReviewDecision` values;
- Decision IDs created through `@api-schema-flow/review/browser`;
- canonical composition of baseline and draft Decision Sets;
- materialization always beginning from `snapshot.declaredGraph`;
- higher-revision Reject superseding a prior Accept without deleting declared-equivalent relationships;
- Undo restoring the previous graph and outcomes;
- no mutation of Snapshot or Review Session inputs;
- projection of source/target labels, schemas, confidence, evidence, blockers, aliases, transform summaries, and source pointers;
- deterministic conflict, invalid, stale, orphaned, applied, superseded, already-present, and pending state priority;
- ambiguous schema variants producing warnings rather than iteration-order guesses.

## Performance verification

The 1,000-candidate filter/sort benchmark remains capped at 100 ms. The implementation avoids locale-aware work inside the hot sort comparator and uses deterministic code-point ordering. The 500-node Review materialization benchmark remains capped at 250 ms.

## Repository gates

The Task 5 Finalize workflow completed successfully after running:

```text
focused Task 5 tests
all Web tests
Web typecheck
Web production build
full pnpm ci:verify
Web fixture drift check
Review browser bundle boundary
Web browser bundle boundary
package boundary checks
git diff --check
```

Temporary Task 4/Task 5 patch payloads and one-shot workflows were removed before the production commit. The permanent workflow set remains:

```text
ci.yml
m3b1-ci.yml
m3b1-source-export.yml
```

## Implementation commit

```text
ef1dbee6efed3bbc6866f926fb2dec4613f7b174
feat(web): compose review decisions and workspace projections
```
