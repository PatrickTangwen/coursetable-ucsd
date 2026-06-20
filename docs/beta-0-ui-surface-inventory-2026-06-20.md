# Beta-0 UI Surface Inventory - 2026-06-20

This document is the planned inventory artifact for `Beta-0 UI Surface Cleanup`.
It should be updated during implementation with exact file paths and observed
browser-smoke evidence.

## Scope

Primary paths:

- `/catalog`
- `/worksheet`
- Course modal opened from catalog, such as `/catalog?course-modal=...`
- Shared chrome visible on those paths

Non-primary static or historical pages remain inventory-only unless linked from
primary paths in a misleading way.

## Hidden From Primary Paths

These inherited surfaces should not appear in primary UCSD public paths:

- Rating, workload, professor-quality, OCE, SET/CAPE, and evaluation UI
- Friends dropdown, friend worksheet viewing, friend counts, and social wording
- Map view and walking-time display/settings
- Google Calendar direct export
- PNG export
- Availability, open seats, enrollment, waitlist, capacity, and demand controls
- Random course affordances
- OCE/evaluation Challenge links
- Public GraphQL playground links
- Original CourseTable external brand links when shown in shared chrome

## Intentionally Retained For Later Adaptation

These inherited surfaces may remain in code if they are not reachable from
primary public paths:

- Saved Search backend/schema/API path, guarded by auth state in the UI
- Auth/session scaffolding that can support later Beta-1 App DB/Auth work
- Worksheet persistence schema/API structures that can be adapted for Saved
  Worksheet work
- Backend/schema/GraphQL/generated-code surfaces that are dormant and do not
  leak unsupported UCSD UI

## Inventory-Only Static Or Historical Pages

These pages are not required to be fully rewritten in Beta-0:

- FAQ
- About
- Privacy
- Release notes
- Profile
- Login
- Challenge
- GraphiQL

If any of these pages are linked from `/catalog`, `/worksheet`, course modal, or
shared chrome with labels that imply currently supported UCSD capabilities, the
link or label should be cleaned up in Beta-0.

## Implementation Evidence To Fill In

- Browser smoke URL(s):
- Browser smoke confirms absent unsupported wording:
- Browser smoke confirms present supported UCSD concepts:
- Hidden/retained source inventory:
- Focused frontend test command(s):
- Typecheck/check command(s):
- Remaining follow-up cleanup:

### Agent 2 / #16 Course Modal Surface Cleanup

- Browser smoke URL(s): `https://127.0.0.1:3000/catalog` to
  `https://127.0.0.1:3000/catalog?course-modal=S126-3612034979`
  using a local static catalog API shim at `http://127.0.0.1:4177`;
  screenshot: `/tmp/coursetable-ucsd-issue16-course-modal-smoke.png`.
- Browser smoke confirms absent unsupported wording: modal text check found no
  `rating`, `workload`, `professor quality`, `evaluation`, `OCE`,
  `SET-CAPE`, `CAPE`, or `friends` wording.
- Browser smoke confirms present supported UCSD concepts: modal showed
  `Archive Avg GPA`, `Record Count`, `Grade Archive Records`, UCSD catalog
  description, section, units, prerequisites, catalog source, meetings, and
  instructor rows.
- Hidden/retained source inventory:
  - `frontend/src/components/CourseModal/ucsdSnapshotCourse.ts` centralizes
    UCSD snapshot-course detection so missing or malformed archive metadata
    does not fall through to inherited CourseTable modal paths.
  - `frontend/src/components/CourseModal/CourseModal.tsx`,
    `Header/InfoRow.tsx`, `Header/ControlsRow.tsx`, and
    `OverviewPanel/OverviewPanel.tsx` use that detection to skip inherited
    GraphQL overview queries, evaluation tabs, OCE/demand/Yale external links,
    and evaluation-panel navigation for UCSD snapshot courses.
  - `frontend/src/components/CourseModal/OverviewPanel/UcsdSnapshotOverview.tsx`
    keeps UCSD catalog metadata, `Archive Avg GPA`, `Record Count`, and
    `Grade Archive Records`, and now renders a UCSD-specific missing
    Historical GPA Data/archive-metadata state instead of falling back to
    rating/workload/evaluation UI.
  - Inherited `EvaluationsPanel/*`, `OverviewRatings.tsx`, and
    `OverviewInfo.tsx` remain in code for dormant/inherited non-UCSD paths;
    backend, schema, GraphQL, and generated code were not deleted.
- Focused frontend test command(s): `bun run --cwd frontend test -- CourseModal
ModalHistoryBridge modalHistoryUrl`; full frontend test command:
  `bun run --cwd frontend test`.
- Typecheck/check command(s): `bun run typecheck`; `git diff --check`.
- Remaining follow-up cleanup: no CourseModal follow-up for #16. Cross-surface
  acceptance remains with #19 after the parallel Beta-0 surface branches merge.
