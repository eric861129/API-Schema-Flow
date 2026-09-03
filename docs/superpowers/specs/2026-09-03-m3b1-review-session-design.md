# M3-B1 Interactive Review Session Design

## Status

Approved for implementation by the repository owner on 2026-09-03 as the first slice of M3-B scheme B: Browser local-first review with IndexedDB and deterministic Decision Set import/export delivered incrementally across M3-B1, M3-B2, and M3-B3.

## Goal

Turn the M3-A read-only workspace into a safe, understandable human review surface where users can inspect inference evidence, accept or reject candidates, and immediately preview the resulting accepted graph without editing mappings or persisting decisions yet.

## Slice boundary

M3-B1 includes:

- a dedicated Inference Review workspace mode;
- candidate filtering, sorting, grouping, and keyboard navigation;
- a focused source-to-target mapping preview;
- an evidence inspector with score breakdown and blockers;
- immutable Accept and Reject decisions;
- structured reject reasons;
- an in-memory Review Session with revision and undo-before-save semantics;
- accepted graph materialization through the existing Review core;
- immediate topology preview of the current draft decisions;
- pending, accepted, rejected, stale, orphaned, superseded, and conflict state presentation;
- responsive, keyboard, accessibility, component, and end-to-end verification.

M3-B1 excludes:

- Edit Mapping and the dual-tree Mapping Editor;
- IndexedDB persistence or auto-save;
- Decision Set file import, download, or clipboard export;
- writing project files;
- Workflow Builder or Arazzo editor;
- Arazzo export UI;
- Stateful Mock Runtime;
- workflow execution or Live Trace;
- cloud storage, authentication, telemetry, or collaboration.

Those exclusions are visible product boundaries. The UI must not render inert Edit, Save, Import, Export, Run, or Mock controls.

## Relationship to scheme B

Scheme B remains the approved M3-B architecture:

```text
Review UI
   ↓
Browser Review Session
   ↓
IndexedDB and deterministic Decision Set files
```

M3-B1 implements the top two layers in memory. M3-B2 adds mapping edits. M3-B3 adds IndexedDB, import/export, migration, and recovery. The M3-B1 state and interfaces must therefore be serializable and persistence-ready, but no persistence adapter is shipped in this slice.

## User outcome

A user can:

1. open the Reservation workspace;
2. enter Inference Review;
3. filter to pending high-confidence candidates;
4. select a candidate;
5. understand the source field, target field, type compatibility, confidence, evidence, and blockers;
6. accept the candidate or reject it with a reason;
7. see the candidate move to its new review state;
8. see the accepted topology preview update immediately;
9. undo the latest unsaved action;
10. repeat the workflow using keyboard-only controls.

## Visual direction

M3-B1 uses the approved simplified V2 Inference Review concept.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ API Schema Flow │ Reservation System │ 5 pending │ Draft changes 2 │
├──────┬───────────────────┬──────────────────────────┬────────────────┤
│ Icon │ Candidate List    │ Mapping Preview          │ Evidence       │
│ Rail │ Search / Filters  │                          │ Inspector      │
│      │ High / Medium     │ Source → Target          │ Rule breakdown │
│      │ Review state      │                          │ Blockers       │
│      │                   │ [Accept] [Reject]        │ Source pointers│
├──────┴───────────────────┴──────────────────────────┴────────────────┤
│ Review summary · Accepted graph preview status · Undo latest change │
└──────────────────────────────────────────────────────────────────────┘
```

Design constraints:

- one primary task: review the selected candidate;
- the candidate list is 280–320 px and remains independently scrollable;
- the mapping preview is the largest region;
- evidence is a 340–400 px conditional/collapsible inspector;
- no floating panel overlaps the mapping preview;
- actions remain visible near the mapping decision, not in the global header;
- 1366 × 768 remains usable;
- at constrained width, the evidence inspector becomes an overlay drawer;
- confidence and state use text, icon/shape, and pattern in addition to color;
- base body text is at least 14 px.

## Information architecture

M3-B1 extends the M3-A icon rail with one real destination:

- **Topology** — accepted operation graph;
- **Outline** — non-spatial graph alternative;
- **Inference Review** — candidate review workspace;
- **Diagnostics** — existing drawer;
- **About** — existing information.

No future destination is rendered before it works.

## Architecture

```text
ReadOnlyWorkspaceSnapshot
  ├─ acceptedGraph
  ├─ inferenceCandidates
  └─ reviewOutcomes
             │
             ▼
Review Session Controller
  ├─ immutable draft decisions
  ├─ current candidate states
  ├─ revision allocator
  └─ undo stack
             │
      ┌──────┴──────────┐
      ▼                 ▼
Review Core       Review View Models
materialize       list / preview / evidence
      │                 │
      └──────┬──────────┘
             ▼
Accepted Graph Draft Preview
```

### Domain ownership

`@api-schema-flow/domain` continues to own `ReviewDecision`, `ReviewDecisionOutcome`, `InferenceCandidate`, and `FlowGraph` contracts.

### Review core ownership

`@api-schema-flow/review` remains the single authority for:

- decision validation;
- revision resolution;
- supersession and conflict semantics;
- stale and orphaned decisions;
- accepted inferred-edge materialization;
- declared-edge preservation;
- semantic duplicate suppression.

The Web app must not reproduce those rules.

### Browser boundary

M3-B1 adds a documented browser-safe Review entry point if the package root contains Node-only composition concerns. The browser entry point exports only pure review decision and materialization functions and must not import:

- Node.js built-ins;
- file or network loaders;
- OpenAPI or Arazzo parsers;
- CLI modules;
- exporters;
- server, mock, or execution runtimes.

An identity-parity test proves browser-created decisions produce the same deterministic IDs as existing Review fixtures. If Node-specific hashing is currently used, it must be isolated or replaced by a browser-compatible deterministic implementation without changing established fixture identities.

## Review Session model

```ts
export interface ReviewSessionState {
  readonly schemaVersion: '1.0'
  readonly projectFingerprint: string
  readonly sourceRevision: string
  readonly baselineDecisions: readonly ReviewDecision[]
  readonly draftDecisions: readonly ReviewDecision[]
  readonly selectedCandidateId: string | null
  readonly filters: ReviewCandidateFilters
  readonly sort: ReviewCandidateSort
  readonly evidenceOpen: boolean
  readonly previewMode: 'mapping' | 'topology'
  readonly history: readonly ReviewSessionHistoryEntry[]
}
```

M3-B1 does not store `savedAt`, IndexedDB keys, file handles, panel widths, or canvas positions in semantic session state.

### Actions

```ts
type ReviewSessionAction =
  | { type: 'select-candidate'; candidateId: string | null }
  | { type: 'accept-candidate'; candidateId: string }
  | {
      type: 'reject-candidate'
      candidateId: string
      reason: ReviewRejectReason
      note?: string
    }
  | { type: 'undo-last-draft' }
  | { type: 'set-query'; query: string }
  | { type: 'toggle-confidence'; band: InferenceConfidenceBand }
  | { type: 'set-review-state'; state: ReviewCandidateStateFilter }
  | { type: 'set-sort'; sort: ReviewCandidateSort }
  | { type: 'toggle-evidence' }
  | { type: 'set-preview-mode'; mode: 'mapping' | 'topology' }
```

### Immutability and revision

- existing decisions are never mutated;
- a new Accept or Reject creates a new decision revision;
- next revision is one greater than the highest known revision for that candidate;
- a second action for the same candidate supersedes the earlier lower revision;
- same-revision conflicts are not created by the UI;
- imported conflicts are displayed from baseline outcomes but remain unresolved in M3-B1;
- timestamps, when present for display, never influence deterministic identity;
- Undo removes only the most recent draft action and restores the prior resolved state.

## Reject reasons

```ts
export type ReviewRejectReason =
  | 'wrong-resource'
  | 'wrong-field'
  | 'not-a-workflow'
  | 'duplicate'
  | 'unsafe-or-ambiguous'
  | 'other'
```

The Reject dialog:

- requires one reason;
- requires a note only for `other`;
- summarizes source and target before confirmation;
- traps focus and returns focus to the Reject button on cancel;
- creates no edge;
- does not send or persist the reason outside memory in M3-B1.

## Candidate state projection

The UI derives a single state for each candidate from Review core outcomes and the current draft set:

```text
pending
accepted
rejected
edited
stale
orphaned
superseded
conflict
invalid
```

M3-B1 can display `edited` baseline outcomes but cannot create new edits. Edited candidates show `Manual accepted` and link to their current mapping in the preview.

Priority when a candidate has multiple diagnostic states:

```text
conflict / invalid
→ stale / orphaned
→ accepted / edited / rejected
→ superseded
→ pending
```

The projection function is pure and fully tested.

## Candidate list

Each row shows:

- source method/path and selector;
- target method/path and target descriptor;
- confidence band and numeric confidence;
- evidence count;
- current review state;
- blocker count when present.

Filters:

- text search over source/target paths, operation IDs, selector, and target name;
- confidence: High, Medium, Low, Hidden;
- state: Pending, Accepted, Rejected, Edited, Needs attention;
- optional `Has blockers` toggle.

Sorts:

- confidence descending;
- target endpoint;
- source endpoint;
- review state.

Defaults:

- state: Pending;
- confidence: High and Medium;
- sort: confidence descending.

Keyboard behavior:

- Arrow Up/Down moves roving focus;
- Enter selects;
- Home/End moves to first/last visible candidate;
- `/` focuses search when focus is outside an input;
- Escape clears search, closes a dialog/drawer, or clears selection according to context;
- no single-letter Accept/Reject shortcut ships in M3-B1, avoiding collisions with assistive technology and text input.

## Mapping preview

The central preview shows:

```text
Source operation
Response status / media type
Selector and schema type/format

          ↓ inferred transfer

Target operation
Target location and name/pointer
Schema type/format and required state
```

It also shows:

- mapping alias when present;
- transform summary when present;
- exact type compatibility;
- format compatibility;
- array depth and unsupported selector warning;
- declared-duplicate suppression status;
- immediate cycle or other blockers;
- an `Accepted graph preview` toggle.

The preview does not render editable handles or draggable field trees.

## Evidence inspector

The evidence inspector presents:

- confidence band and score;
- positive, negative, and neutral evidence groups;
- each `ruleId`, weight, summary, and source pointers;
- blocker code and explanation;
- rule-set version;
- candidate stable ID and fingerprint in a copyable details disclosure;
- a concise explanation that inference is a candidate, not an authoritative workflow fact.

The inspector uses headings, definition lists, and simple rows rather than nested cards.

## Accept behavior

Accepting a candidate:

1. creates an immutable `accept` decision at the next revision;
2. resolves all baseline and draft decisions through Review core;
3. materializes the accepted graph through Review core;
4. changes the list state to `Accepted`;
5. adds or reveals the `inferred + accepted` edge in the draft preview;
6. preserves declared edges unchanged;
7. announces the result once through a polite live region;
8. moves selection to the next visible pending candidate when available.

If Review core reports conflict, stale, invalid, duplicate, or missing-node state, no edge is added and the UI shows the specific outcome.

## Reject behavior

Rejecting a candidate:

1. opens the structured reason dialog;
2. creates an immutable `reject` decision at the next revision after confirmation;
3. resolves through Review core;
4. removes an earlier accepted inferred edge if the higher revision now rejects it;
5. changes the list state to `Rejected`;
6. never removes a declared edge;
7. announces the result once;
8. moves to the next visible pending candidate when available.

## Draft accepted graph preview

M3-B1 supports two presentations driven by the same current materialization result:

- **Mapping preview** — selected candidate detail;
- **Topology preview** — the M3-A graph canvas displaying the current draft accepted graph.

Topology preview rules:

- baseline accepted graph is visible;
- newly accepted inferred edges use the existing accepted-inferred visual language;
- rejected candidate edges are absent unless an equivalent declared edge exists;
- edited baseline edges remain manual accepted;
- pending candidates are not inserted into the authoritative graph;
- a compact summary states how many edges are declared, accepted inferred, and manual;
- the preview is explicitly labeled `Draft review preview — not saved`.

## Dirty state and undo

Top bar status:

```text
No draft changes
1 unsaved review change
N unsaved review changes
```

Because persistence is deferred, `unsaved` means the session exists only in the current browser memory. A short non-blocking notice states that refreshing the page discards M3-B1 changes.

Undo:

- is enabled only when history is non-empty;
- removes the most recent draft decision;
- recomputes outcomes and graph through Review core;
- restores selection when possible;
- is keyboard reachable;
- does not support redo in M3-B1.

## Error handling

Concrete states:

- no inference candidates;
- current filters return no candidates;
- candidate references a missing operation;
- Review core rejects a decision;
- graph materialization diagnostic;
- baseline conflict/stale/orphaned state;
- browser entry point or snapshot version mismatch.

Errors preserve the original M3-A read-only topology. A Review failure must not corrupt or replace the loaded snapshot.

## Accessibility

MUST:

- expose candidate list as a labeled composite with clear selected and review states;
- support keyboard-only candidate selection, evidence inspection, Accept, Reject, dialog completion, undo, and topology preview;
- return dialog focus correctly;
- provide text for confidence, blocker, and state meanings;
- never depend on edge color alone;
- keep actions at least 44 × 44 CSS pixels where pointer interaction is expected;
- pass axe with no serious or critical violations in review, dialog, and preview states;
- honor reduced motion;
- preserve operation and relationship meaning in an accessible Review Summary table;
- limit live announcements to completed review actions and blocking failures.

## Performance

- filtering/sorting 1,000 candidates completes under 100 ms in the unit benchmark;
- Accept/Reject materialization for 1,000 candidates and a 500-node graph completes under 250 ms in the browser benchmark fixture;
- candidate list uses content visibility or virtualization only if benchmark evidence requires it;
- evidence is computed in pure selectors and memoized by candidate ID, outcome revision, and filters;
- React state stores IDs and primitives rather than duplicating full candidate objects;
- heavy topology/layout code remains lazy-loaded when switching to topology preview.

## Testing strategy

### Review core browser parity

- browser entry point bundles without Node built-ins;
- accept/reject IDs match existing Review fixture identities;
- resolution and materialization output matches Node-side expected fixtures;
- declared-edge preservation and duplicate suppression remain unchanged.

### Review session unit tests

- initial projection from baseline outcomes;
- next revision allocation;
- Accept;
- Reject with each structured reason;
- second action supersedes first;
- Undo;
- selection advancement;
- filter and sort determinism;
- conflict/stale/orphaned presentation;
- no mutation of snapshot arrays;
- 1,000-candidate performance.

### Component tests

- Review navigation destination;
- candidate count, groups, filters, and empty state;
- mapping preview;
- evidence breakdown and blockers;
- Accept action;
- Reject dialog validation;
- dirty status and Undo;
- topology preview synchronization;
- no Edit, Save, Import, Export, Run, or Mock controls.

### End-to-end tests

Canonical journey:

```text
Open Reservation workspace
→ enter Inference Review
→ select a high-confidence pending candidate
→ inspect evidence
→ accept
→ verify accepted graph preview
→ select another pending candidate
→ reject with reason
→ verify no edge
→ undo rejection
→ verify pending state restored
→ complete the same journey with keyboard only
```

Viewports:

- 1440 × 900;
- 1366 × 768.

Automated accessibility checks run on:

- candidate list and mapping preview;
- evidence inspector;
- Reject dialog;
- accepted topology preview;
- review summary alternative.

## CI and boundaries

CI adds or extends:

- Review browser-entry bundle check;
- Web Review unit/component tests;
- review-session performance benchmark;
- M3-B1 Playwright and axe journey;
- exact snapshot and M0–M3-A regressions;
- production bundle scan for prohibited Node/runtime imports.

Package boundaries:

- Review browser entry may depend only on Domain, Diagnostics, Flow, and browser-safe identity utilities;
- Web may import the Review browser entry but not Node-only parsing/file APIs;
- Web Review code must not import OpenAPI, Arazzo, Source Loader, CLI, Exporter, Mock, Execution, Fastify, Hono, or MSW;
- the Review core remains free of React and IndexedDB;
- M3-B1 adds no persistence dependency.

## Acceptance criteria

M3-B1 is complete when:

1. M3-A is merged to `main` and its post-merge CI succeeds before the M3-B1 branch is used.
2. Inference Review is a real workspace destination.
3. Candidates can be searched, filtered by confidence/state, sorted, and selected with keyboard or pointer.
4. The selected candidate displays complete source, target, schema, confidence, evidence, blocker, and identity information.
5. Accept creates a new immutable revision and Review core returns an `inferred + accepted` edge when valid.
6. Reject requires a structured reason and produces no candidate edge.
7. A later Accept or Reject supersedes the earlier lower revision according to existing Review semantics.
8. Declared edges remain unchanged.
9. Pending candidates never enter the accepted graph.
10. The topology draft preview updates immediately from Review core materialization.
11. Conflict, stale, orphaned, invalid, and duplicate outcomes produce no untrusted edge and display a concrete explanation.
12. Undo removes the latest in-memory draft decision and recomputes the preview.
13. Dirty status clearly states that M3-B1 changes are not persisted.
14. No Edit Mapping, persistence, import/export, execution, Mock, or cloud control is present.
15. The full review journey works at 1440 × 900 and 1366 × 768.
16. The review workflow has a keyboard-only path and axe reports no serious or critical violations.
17. Review browser bundle contains no Node built-ins or prohibited runtime package.
18. 1,000-candidate filtering and review materialization meet the documented performance targets.
19. Existing M0–M3-A tests and visual behavior remain green.
20. Exact-head GitHub Actions succeeds before merge.

## Follow-up boundaries

### M3-B2

Adds Edit Mapping, source/target schema selection, compatibility validation, and manual accepted edges.

### M3-B3

Adds IndexedDB storage, auto-save, schema migration, deterministic Decision Set import/export, corrupted-storage recovery, conflict import summary, and reload restoration.
