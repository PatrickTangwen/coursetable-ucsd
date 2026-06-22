# UCSD Course Planner

UCSD Course Planner is a student-facing course search and worksheet planning
tool for UCSD. It is built from the CourseTable codebase, but the current
product experience is focused on UCSD catalog browsing, historical grade
context, and schedule planning.

The app can be used without an account. In configured beta/backend
environments, a verified `@ucsd.edu` sign-in enables account-owned saved
worksheets.

## What You Can Do

- Browse the published UCSD catalog snapshot for the active planning term.
- Search and sort supported UCSD courses.
- Open a course detail modal with description, section, meeting time,
  instructor, units, prerequisite text, restrictions, and source catalog link
  when available.
- Review historical grade context from UCSD Instructor Grade Archive data:
  catalog results show Average GPA and Record Count, and course details include
  a Past Grades tab with raw archive rows.
- Add sections to a worksheet and view them on a calendar or list.
- Use the worksheet without signing in; unsigned worksheet changes are stored in
  the current browser.
- Share or restore worksheet state through supported worksheet URLs.
- Export worksheet courses to an ICS calendar file.
- Sign in with a verified UCSD email when the account beta backend is
  configured.
- Use account-owned Saved Worksheets after sign-in: Main Worksheet, blank
  worksheet creation, worksheet selection, rename, delete, and persisted
  add/remove/hide/color edits.

## Current Data Scope

The current published snapshot is intentionally narrow:

- Active planning term: `S126` / Summer Session I 2026.
- Supported subjects: `CSE` and `MATH`.
- Catalog and meeting data come from UCSD Schedule of Classes and UCSD General
  Catalog sources.
- Historical grade data comes from UCSD Instructor Grade Archive records.

The app is not a live enrollment tracker. It does not currently show open
seats, waitlist counts, enrollment demand, or real-time availability.

## Accounts And Worksheets

You can plan before signing in. In that mode, the worksheet auto-saves in this
browser only.

After signing in with a direct `@ucsd.edu` email address, the worksheet page
opens the account's Main Worksheet for the active term. Extra Saved Worksheets
can be created from the worksheet selector. Course changes on an active Saved
Worksheet are persisted to the backend.

Signing in does not automatically merge, sync, clear, or import the browser's
local worksheet. Copying browser-local worksheet state into an account worksheet
is future product scope.

## Not Currently Supported

- All UCSD subjects.
- Multi-term planning beyond the active published snapshot.
- Real-time seats, waitlists, enrollment, or demand signals.
- SET/CAPE or personal UCSD account scraping.
- Friends, social planning, public worksheet sharing controls, or wishlist.
- Google OAuth or direct Google Calendar export.
- Production-like email delivery for verification codes.

Some inherited CourseTable code remains in the repository for future reuse, but
unsupported surfaces are hidden from the current UCSD user flow.

## Running Locally

This repository uses Bun workspaces.

```bash
bun install
bun run --cwd frontend start
```

For the full local backend validation stack, Docker is required:

```bash
api/compose/local-validation-up.sh
api/compose/local-validation-schema.sh
bun run validate:real-backend-auth
```

Useful project scripts:

```bash
bun run checks
bun run snapshot:publish
bun run snapshot:tracer
bun run test:snapshot
```

## Project Notes

Current planning and decision documents start at
[`docs/planning-index.md`](docs/planning-index.md). Domain language is recorded
in [`CONTEXT.md`](CONTEXT.md), and architectural decisions live under
[`docs/adr/`](docs/adr/).
