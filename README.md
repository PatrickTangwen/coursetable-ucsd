# SunGrid

SunGrid is a course discovery and schedule planning app for UCSD students. It
helps students browse UCSD course offerings, compare sections, inspect historical
grade context, and build worksheets within the current planning window.

SunGrid is open source and can be used without an account. Signing in with a
verified UCSD email adds account-backed features such as saved worksheets and
saved filters/searches.

## What SunGrid Does

- Search UCSD courses by course code, title, instructor, subject, building,
  day/time, course number, enrollment range, and course attributes.
- Browse multiple supported terms from Summer Session II 2024 through Fall 2026.
- Open course details with descriptions, sections, meeting times, instructors,
  units, prerequisite text, restrictions, source catalog links, and section
  availability from the published snapshot.
- Review historical GPA context from UCSD Instructor Grade Archive records in a
  course's Past Grades view.
- Add sections from Summer Session I 2026 through Fall 2026 to a worksheet and
  view them as a calendar or list. Earlier Catalog terms remain available for
  browsing without worksheet add/remove controls.
- Spot schedule conflicts, hide courses from the calendar, adjust course colors,
  and switch between terms in the worksheet planning window.
- Export a worksheet as an `.ics` calendar file or copy a shareable worksheet
  URL.
- Use the app anonymously with browser-local worksheet storage.
- Sign in with a verified `@ucsd.edu` email to save worksheets and filters to an
  account.

## Data Sources And Freshness

SunGrid is built around published catalog snapshots. The app combines public
UCSD data from:

- UCSD Schedule of Classes
- UCSD General Catalog
- UCSD Instructor Grade Archive

Availability fields such as enrolled count, capacity, and waitlist count are
snapshot-static. They are useful for planning context, but they are not live
WebReg data and should not be treated as real-time enrollment availability.

## Accounts

You can plan without signing in. Anonymous worksheets are stored in the current
browser and can be shared or restored through supported worksheet URLs.

With UCSD email sign-in, SunGrid stores account-owned saved worksheets and saved
filters/searches. Signed-in worksheet data is separate from browser-local
anonymous worksheet data; signing in does not automatically merge or import a
local worksheet.

## Current Limitations

SunGrid does not provide:

- Real-time enrollment, seat, waitlist, or demand tracking.
- SET/CAPE results or personal UCSD account scraping.
- Official UCSD enrollment actions.
- Google OAuth or direct Google Calendar write access.
- Social planning, friends, wishlist, or public worksheet permission controls.

SunGrid is an independent open-source project and is not an official UCSD
service.

## For Contributors

This repository contains the SunGrid frontend, backend/auth service, static
catalog snapshot tooling, and project documentation.

The stable documentation entry point is [`docs/README.md`](docs/README.md).
Local frontend/backend/login setup is documented in
[`docs/local_server.md`](docs/local_server.md). Domain terminology is recorded in
[`CONTEXT.md`](CONTEXT.md), and architectural decisions live in
[`docs/adr/`](docs/adr/).

### Local Development

This repository uses Bun workspaces.

```bash
bun install
bun run --cwd frontend start
```

For the full local backend and UCSD email sign-in validation stack, follow
[`docs/local_server.md`](docs/local_server.md).

Common maintenance checks:

```bash
bun run checks
bun run snapshot:publish
bun run snapshot:tracer
bun run test:snapshot
```
