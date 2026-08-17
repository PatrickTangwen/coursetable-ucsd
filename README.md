<p align="right">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://sungridplanner.com/catalog">
    <img src="./assets/readme/en/hero.svg" width="100%" alt="SunGrid: search the UCSD catalog and settle a workable week before enrollment. A five-column week grid sits beside the title, with a few cells filled in.">
  </a>
</p>

<p align="center">
  <strong>Search the UCSD catalog, compare real section details, and settle a workable week before enrollment.</strong><br>
  Free to browse. No account required.
</p>

<p align="center">
  <a href="https://sungridplanner.com/catalog">Open the planner</a> ·
  <a href="https://sungridplanner.com/tutorial">View the tutorial</a> ·
  <a href="https://tally.so/r/q47EA8">Send feedback</a>
</p>

Every screenshot below is the running product on Fall 2026 data.

<p align="center">
  <img src="./assets/readme/shots/catalog.jpg" width="100%" alt="Catalog view filtered to Fall 2026 CSE courses, showing meeting days, times, rooms, and remaining seats for each section.">
</p>

Filters narrow 345 results down to the sections that could actually fit. Meeting
days, times, rooms, and seats sit on the row itself, so comparing offerings does
not mean opening fifteen tabs.

<p align="center">
  <img src="./assets/readme/shots/worksheet.jpg" width="100%" alt="Worksheet calendar for Fall 2026 with CSE-012 and CSE-030 blocks across the week, plus a summary showing 2 courses, 8 credits, and no conflicts.">
</p>

Sections you add land on a five-day grid, with credits, the first exam date, and
a conflict count next to it.

<p align="center">
  <img src="./assets/readme/en/section-plan.svg" width="100%" alt="01 From catalog search to a week that holds up.">
</p>

Discovery and schedule building stay in the same loop. You search, open the
offering you actually want, add one of its sections, and keep going until the
week either works or clearly does not.

| Step    | What the product gives you                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Search  | Code, title, instructor, subject, building, day, time, level, units, enrollment range, and course attributes                                |
| Inspect | Descriptions, prerequisites, restrictions, instructors, meeting patterns, source links, snapshot availability, and past grade distributions |
| Build   | Calendar or list view, supported worksheet terms, credits and exam dates, hidden courses, adjustable colors                                 |
| Keep    | A shareable worksheet URL, an `.ics` export for Apple, Google, or Outlook, and the weekly grid as a PNG                                     |

<p align="center">
  <img src="./assets/readme/shots/course-detail.jpg" width="100%" alt="Course modal for CSE-012 on the Past Grades tab, listing GPA and grade-bucket percentages per term and instructor across 40 terms on record.">
</p>

The course modal keeps the decision material in one place: what the course
covers, who teaches which section, how the sections map to each other, and how
past terms actually graded.

<p align="center">
  <img src="./assets/readme/shots/conflicts.jpg" width="100%" alt="Schedule conflicts dialog listing one time conflict and one final exam conflict between CSE-020 and CSE-100, with the overlapping days and hours.">
</p>

Conflicts are named rather than implied. Both lecture overlap and shared final
exam slots are reported, with the days and hours that collide.

<p align="center">
  <img src="./assets/readme/en/section-data.svg" width="100%" alt="02 Public UCSD data, with its timestamp attached.">
</p>

<p align="center">
  <img src="./assets/readme/en/data-flow.svg" width="100%" alt="Schedule of Classes, General Catalog, and Instructor Grade Archive feed one published term snapshot, which serves catalog search and worksheet planning.">
</p>

Course information is assembled from three public UCSD sources: the Schedule of
Classes, the General Catalog, and the Instructor Grade Archive. They become one
published snapshot per supported term, which is what keeps search fast and each
term reproducible.

Anything tied to a snapshot shows when the snapshot was published, so a number
from last night reads differently from a number kept for a term that has already
closed.

> Enrollment, capacity, seat, and waitlist values are snapshot-based, not live
> WebReg data. Confirm official course information and availability in UCSD
> systems before you enroll.

<p align="center">
  <img src="./assets/readme/en/section-start.svg" width="100%" alt="03 Open it and start planning.">
</p>

Open the catalog and start adding sections. Nothing in basic course discovery or
planning waits behind a sign-up form. While signed out, the worksheet lives in
the current browser, and a supported share URL can restore the sections it
holds.

Students who verify a `@ucsd.edu` address keep account-owned worksheets and
saved filters across sessions. Account data stays separate from the
browser-local worksheet: signing in does not silently import, merge, or erase
the local plan.

<p align="center">
  <a href="https://sungridplanner.com/catalog"><strong>sungridplanner.com/catalog</strong></a>
</p>

## Where the boundary is

This planner does not enroll students, scrape personal UCSD accounts, track
seats or demand in real time, publish SET/CAPE results, write directly to Google
Calendar, or add social permission controls to worksheets.

It is an independent service and not an official UC San Diego product. UC San
Diego names and source links identify the institution and the public information
sources only.

New original contributions first published with or after the current license
change are not licensed for public reuse. Third-party and previously released
portions remain subject to their applicable terms. See [`LICENSE`](./LICENSE)
for details.
