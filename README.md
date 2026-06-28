# SunGrid — UCSD Course Planning Platform

SunGrid is a student-facing course search and schedule planning tool for UCSD.
It is built from the CourseTable codebase, with the product experience focused
on multi-term catalog browsing, historical grade context, snapshot-static
availability data, and worksheet planning across terms.

The app can be used without an account. In configured beta/backend
environments, a verified `@ucsd.edu` sign-in enables account-owned saved
worksheets.

## What You Can Do

- Browse published UCSD catalog snapshots across multiple terms.
- Switch between terms with a term selector in both catalog and worksheet views.
- Search and sort all UCSD subjects.
- Open a course detail modal with description, section, meeting time,
  instructor, units, prerequisite text, restrictions, snapshot-static
  availability (enrolled, capacity, waitlist), and source catalog link when
  available.
- Review historical grade context from UCSD Instructor Grade Archive data:
  catalog results show Average GPA, and course details include a Past Grades
  tab with raw archive rows.
- Add sections to a per-term worksheet and view them on a calendar or list.
- Use the worksheet without signing in; unsigned worksheet changes are stored
  per-term in the current browser.
- Share or restore worksheet state through supported worksheet URLs.
- Export worksheet courses to an ICS calendar file.
- Sign in with a verified UCSD email when the account beta backend is
  configured.
- Use account-owned Saved Worksheets after sign-in: Main Worksheet, blank
  worksheet creation, worksheet selection, rename, delete, and persisted
  add/remove/hide/color edits. Cross-term catalog adds route into the target
  term's saved worksheet.

## Current Data Scope

- Published catalog terms: 14 terms from Summer Session II 2024 (`S224`)
  through Summer Session III 2026 (`S326`), via forward-accumulating multi-term
  archive.
- Subjects: all UCSD subjects discovered from the Schedule of Classes source.
- Catalog and meeting data come from UCSD Schedule of Classes and UCSD General
  Catalog sources.
- Historical grade data comes from UCSD Instructor Grade Archive records.
- Availability data (enrolled, capacity, waitlist) is snapshot-static, not
  real-time. Every availability surface shows the snapshot timestamp.

## Accounts And Worksheets

You can plan before signing in. In that mode, the worksheet auto-saves per-term
in this browser only. A term selector lets you switch between terms.

After signing in with a direct `@ucsd.edu` email address, the worksheet page
opens the account's Main Worksheet for the viewed term. Extra Saved Worksheets
can be created from the worksheet selector. Course changes on an active Saved
Worksheet are persisted to the backend.

Signing in does not automatically merge, sync, clear, or import the browser's
local worksheet. Copying browser-local worksheet state into an account worksheet
is future product scope.

## Not Currently Supported

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
[`docs/planning/README.md`](docs/planning/README.md). Domain language is recorded
in [`CONTEXT.md`](CONTEXT.md), and architectural decisions live under
[`docs/adr/`](docs/adr/).
