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

### Agent 1 / #15 Catalog Discovery Surface Cleanup

- Browser smoke URL(s): `http://127.0.0.1:3025/catalog` from the Agent 1 clean
  verification worktree, using a production frontend build, local anonymous
  API shim, and tracer Published Snapshot; screenshot:
  `/tmp/coursetable-ucsd-issue15-catalog-smoke.png`.
- Browser smoke confirms absent unsupported wording: real Chromium text check
  found no `workload`, `professor quality`, `rating`, `OCE`, `evaluation`,
  `friends`, `social`, `open seats`, `waitlist`, `enrollment`, `demand`,
  `random course`, or `I'm feeling lucky` wording on `/catalog`.
- Browser smoke confirms present supported UCSD concepts: `/catalog` showed
  keyword search, subject/area filters, season, advanced supported filters,
  `Archive Avg GPA`, `Record Count`, instructors, meeting/location columns,
  snapshot freshness, and result rows from the tracer UCSD snapshot. Opening
  Saved Search as an anonymous user showed `Sign in required.` and the smoke
  API recorded no `/api/savedSearches` requests.
- Hidden/retained source inventory:
  - `frontend/src/pages/Search.tsx` resets hidden inherited catalog filters and
    unsupported sort state on `/catalog`, so stale URLs or older saved searches
    cannot silently keep applying rating, workload, professor-rating,
    enrollment, or Quist filters after those controls are hidden.
  - `frontend/src/components/Search/ResultsHeaders.tsx`, `ResultsItem.tsx`,
    `ResultsGridItem.tsx`, `ResultsCols.module.css`, and `Results.module.css`
    hide inherited rating, workload, professor-quality, enrollment, friends,
    and catalog grid-toggle affordances from the catalog results surface while
    showing UCSD `Archive Avg GPA`, `Record Count`, instructors, meeting time,
    location, and snapshot-added date.
  - `frontend/src/components/Search/NavbarCatalogSearch.tsx`,
    `MobileSearchForm.tsx`, and `AdvancedPanel.tsx` hide inherited rating,
    workload, professor-rating, enrollment, and Quist controls while preserving
    keyword search, subject/area filters, season, days/time, course number,
    course attributes/meeting-type filters, building, and hide-conflicts.
  - `frontend/src/components/Search/Results.tsx` disables catalog grid
    switching while retaining worksheet reuse of the shared results component.
    `frontend/src/components/Search/RandomButton.tsx` hard-disables the
    inherited random-course affordance wherever shared chrome mounts it on
    `/catalog`.
  - `frontend/src/components/Search/SavedSearchesDropdown.tsx` keeps the Saved
    Search dropdown visible as later signed-in capability, renders a non-error
    sign-in-required state for anonymous users, and guards protected
    saved-search fetch/create/delete calls so they do not fire unless the store
    auth state is authenticated. Saved-search query strings are sanitized to
    supported catalog filters and supported sort fields before apply/save.
  - Backend, schema, GraphQL, generated code, and saved-search API endpoints
    remain in source for later App DB/Auth adaptation.
- Focused frontend test command(s): `bun run --cwd frontend test` passed in
  the Agent 1 clean verification worktree: 9 test files, 44 tests.
- Typecheck/check command(s): `bun run typecheck` passed; `git diff --check`
  passed. Production build for smoke also passed with
  `VITE_API_ENDPOINT=http://127.0.0.1:3025 bun run --cwd frontend build`.
- Remaining follow-up cleanup: the saved-search backend/schema/API path remains
  intentionally retained for later Beta-1 App DB/Auth adaptation; cross-surface
  acceptance remains with #19 after the parallel Beta-0 surface branches merge.

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
### Agent 4 / #18 Shared Chrome And Global Metadata Cleanup

- Browser smoke URL(s): `https://127.0.0.1:3019/catalog` and
  `https://127.0.0.1:3019/worksheet` from the main checkout on
  `beta0d-chrome-cleanup`.
- Browser smoke confirms absent unsupported wording: navbar, footer, and
  hydrated browser title did not contain `CourseTable`, `Yale`, `OCE`,
  `Challenge`, `GraphQL playground`, `GraphiQL`, `demand statistics`, or
  `student evaluations` on `/catalog` or `/worksheet`.
- Browser smoke confirms present supported UCSD concepts: both paths showed
  `UCSD Course Planner`; navigation to `Catalog` and `Worksheet` remained; the
  footer showed `Anonymous Worksheet`; the hydrated title was
  `UCSD Catalog & Anonymous Worksheet`.
- Hidden/retained source inventory: `frontend/src/components/Navbar/Navbar.tsx`
  hides the Challenge link and inherited mobile static/support links from
  primary chrome and removes the random-course affordance from catalog chrome;
  `frontend/src/components/Navbar/MeDropdown.tsx` retains only
  beta-labeled sign-in/profile actions in the desktop account menu;
  `frontend/src/components/Footer.tsx` hides GraphQL playground, original
  CourseTable feedback/status/GitHub/LinkedIn/support links, and the inherited
  donation badge from primary footer chrome; `frontend/index.html` and
  `frontend/src/App.tsx` now use UCSD public catalog plus Anonymous Worksheet
  metadata. Dormant `/challenge` and `/graphiql` routes/pages remain in source
  for inventory-only follow-up and are not linked from navbar/footer primary
  chrome.
- Focused frontend test command(s): `bun run --cwd frontend test` passed in the
  main checkout: 11 test files, 49 tests. The same command also passed earlier
  in an isolated Agent 4 worktree with 9 test files and 44 tests.
- Typecheck/check command(s): `bun run typecheck` and `git diff --check` passed
  in the main checkout. Both commands also passed earlier in an isolated Agent 4
  worktree with only the shared-chrome/global-metadata diff applied.
- Remaining follow-up cleanup: static/historical pages such as Challenge,
  GraphiQL, FAQ, About, Privacy, Release notes, Profile, and Login still need
  later inventory/adaptation before they are re-linked as current UCSD product
  surfaces.
