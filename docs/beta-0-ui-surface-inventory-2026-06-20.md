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

### Agent 4 / #18 Shared Chrome And Global Metadata Cleanup

- Browser smoke URL(s): `https://127.0.0.1:3019/catalog` and
  `https://127.0.0.1:3019/worksheet` from the main checkout on
  `beta0d-chrome-cleanup`.
- Browser smoke confirms absent unsupported wording: navbar, footer, and
  hydrated browser title did not contain `CourseTable`, `Yale`, `OCE`,
  `Challenge`, `GraphQL playground`, `GraphiQL`, `demand statistics`, or
  `student evaluations` on `/catalog` or `/worksheet`. The catalog navbar also
  did not show the inherited `I'm feeling lucky` random-course affordance.
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
  metadata; `frontend/src/utilities/constants.ts` replaces inherited
  Yale-campus search-speed phrases that can render inside catalog navbar chrome.
  Dormant `/challenge` and `/graphiql` routes/pages remain in source for
  inventory-only follow-up and are not linked from navbar/footer primary chrome.
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
