# SunGrid — UCSD Course Planning Platform

Domain language for SunGrid, a UCSD course discovery and schedule planning
platform built from a CourseTable fork.

## Language

**MVP-1**:
The first releasable version of the platform, focused on public course discovery and anonymous schedule planning.
_Avoid_: Full MVP, beta, logged-in MVP

**Beta-0 UI Surface Cleanup**:
The first post-MVP implementation slice, focused on removing inherited CourseTable/Yale product surfaces from public UCSD catalog and worksheet paths before adding signed-in persistence.
_Avoid_: Auth beta, persistence beta, full redesign

**Beta-1 Real Backend Auth Validation**:
The post-Auth Foundation validation slice that proves UCSD User Identity and App DB ownership against the full local CourseTable Compose backend stack before production-like email delivery.
_Avoid_: Email delivery beta, hosted staging rollout, new product capability

**Beta-1 Save Anonymous Worksheet To Account**:
The completed transitional post-auth slice that proved App User ID ownership
for saving and restoring browser-local worksheet state as Saved Worksheets. The
current Saved Worksheet Management UX no longer exposes this as the default
worksheet-page interaction.
_Avoid_: Current default worksheet UX, automatic save on login, implicit sync

**Catalog Snapshot**:
A term-scoped, self-contained JSON data artifact that the frontend uses for catalog search, course detail, and anonymous worksheet planning in MVP-1.
_Avoid_: Live catalog query, GraphQL catalog, database-backed catalog

**Published Snapshot**:
The validated Catalog Snapshot currently served from the app's static catalog path.
_Avoid_: Partial snapshot, staging snapshot, generated draft

**Active Planning Term**:
The single UCSD term whose live schedule sections are included in the MVP-1 Catalog Snapshot.
_Avoid_: Current term, selected term, default term

**Term Date Range**:
The configured start and end dates used to expand recurring meeting times for calendar export.
_Avoid_: Academic calendar, scraped date range, inferred quarter dates

**Configured Subject**:
A UCSD subject code included in the MVP-1 data pipeline and Catalog Snapshot.
_Avoid_: All subjects, department, school

**Historical GPA Data**:
Past grade archive records imported from UCSD's Instructor Grade Archive and used as historical course outcome signals.
_Avoid_: Course ratings, workload data, evaluation data

**Instructor Grade Archive**:
The UCSD source used for MVP-1 historical GPA records, queried by subject keyword and parsed from its results table.
_Avoid_: GPA CSV, SET, CAPE, course evaluation archive

**Grade Archive Record**:
A subject-course-year-quarter-instructor row from the Instructor Grade Archive, containing GPA and grade-bucket percentages.
_Avoid_: Evaluation, review, rating, grade count record

**Average GPA**:
The user-facing Historical GPA summary for a Course. For UCSD snapshot courses,
this is the unweighted mean GPA across matching Grade Archive Records in the
most recent archive term that has data.
_Avoid_: Weighted GPA, course rating, sample-size-adjusted GPA

**Record Count**:
The total number of matching Grade Archive Records across all terms. It can be
shown in catalog/search results as archive-depth context, but is not a Course
modal Overview summary card.
_Avoid_: Student count, sample size, enrollment

**Past Grades**:
The Course modal tab next to Overview that shows raw Grade Archive Records,
ordered by term descending.
_Avoid_: Evaluations tab, ratings tab, professor reviews

**Archive Avg GPA**:
Legacy/internal snapshot field language for `archive_avg_gpa`. Use Average GPA
for current user-facing copy.
_Avoid_: Visible current UI label

**Snapshot Availability Data**:
Enrolled count, seat capacity, and waitlist count scraped from the UCSD Schedule
of Classes at snapshot-generation time and included in the Catalog Snapshot as
static fields. Not refreshed in real time. Every UI surface displaying this data
must show the snapshot timestamp. Supersedes the original exclusion in ADR 0004;
see ADR 0011.
_Avoid_: Real-time availability, live seat count, enrollment tracker, demand signal

**Excluded Availability Directions**:
Product directions that remain intentionally excluded even after ADR 0011: seat
availability history, real-time WebReg polling, enrollment trends, worksheet
demand ("in N worksheets"), friends taking course, and availability-based
sorting or filtering.
_Avoid_: Treating these as deferred features

**Course**:
A catalog-level UCSD class identified by subject and course number, independent of a specific scheduled offering.
_Avoid_: Listing, section, class instance

**Section**:
A term-specific scheduled offering of a course that a student can add to a worksheet.
_Avoid_: Listing, course row, class

**Course ID**:
The canonical identity for a course, formed from normalized subject and course number.
_Avoid_: Course title, professor-derived ID, database row ID

**Section ID**:
The canonical identity for a section, formed from term and the UCSD source section identifier.
_Avoid_: Meeting-derived ID, title-derived ID, CRN

**Meeting**:
A scheduled time-and-location block belonging to a section; a section may have zero, one, or many meetings.
_Avoid_: Event, time slot, appointment

**Section Family**:
The letter prefix of a section code (e.g., "A" from "A01", "B" from "B50")
used to group related sections that share a common lecture. Sections with
numeric-only codes (e.g., "001") have an empty family.
_Avoid_: Offering group (which is the UI-layer concept built from families)

**Offering Group**:
A UI-layer grouping of sections within a course that share a Section Family
prefix, representing one possible schedule combination. Built at render time by
comparing meetings across sections in the same family: shared meetings (same
type, days, time, location) become anchor rows; varying meetings become
selectable rows. Not stored in the Catalog Snapshot.
_Avoid_: Section family (which is the raw data grouping), schedule option

**SunGrid**:
The product name for the UCSD course planning platform. Replaces the inherited
CourseTable brand in all user-facing surfaces.
_Avoid_: CourseTable, UCSD Course Planner

**Worksheet**:
A student-selected set of course sections for planning a schedule within a term.
_Avoid_: Cart, schedule cart, saved schedule

**Anonymous Worksheet**:
A browser-local worksheet that is not attached to a user account. This term is
primarily implementation and historical planning language; current user-facing
copy should usually say Worksheet or Main Worksheet.
_Avoid_: Saved worksheet, server worksheet, account worksheet, visible product label

**Local Worksheet**:
Historical/user-support shorthand for the browser-local Worksheet used while
signed out. Current UI should not present Local Worksheet as a separate object
beside Saved Worksheets. Signed-out users use the same add/remove/hide/color
workflow and the same visible Worksheet language; those edits persist in
`localStorage`. After sign-in, the visible worksheet switches to the account's
Active Saved Worksheet, normally Main Worksheet. Browser-local contents are not
automatically merged, synced, cleared, or surfaced through a default import
prompt.
_Avoid_: Saved worksheet, account worksheet, synced worksheet, import prompt

**App DB**:
The backend persistence store for signed-in user product data such as saved worksheets, saved searches, wishlist, and privacy settings.
_Avoid_: Course Data Store, Catalog Snapshot database, Hasura requirement

**UCSD User Identity**:
The signed-in account identity used to own App DB records for UCSD product features.
_Avoid_: Personal UCSD scraping account, SET/CAPE login, anonymous browser identity

**App User ID**:
The internal stable identifier for a signed-in user in the App DB.
_Avoid_: NetID, email local-part, browser identity

**Verified UCSD Email**:
An `@ucsd.edu` email address proven by an auth verification code or magic link and used to establish UCSD User Identity.
_Avoid_: Google account, UCSD scraping account, anonymous identity

**Saved Worksheet**:
A worksheet attached to a signed-in user account and persisted by the backend.
_Avoid_: Anonymous worksheet, local worksheet

**Main Worksheet**:
The default user-facing worksheet name. While signed out, Main Worksheet is the
browser-local worksheet persisted in `localStorage`. While signed in, Main
Worksheet is the user's first or primary term-scoped Saved Worksheet, owned by
App User ID and made of Section IDs. Signed-in users should land on the term's
Main Worksheet instead of being asked to manage a separate browser-local
worksheet by default. For each supported term a signed-in user should always
have at least one Saved Worksheet; the only Saved Worksheet in that term is not
user-deletable. It is not the legacy CourseTable worksheet-number model.
_Avoid_: Legacy main worksheet, worksheet number zero, netId-owned worksheet

**Blank Saved Worksheet**:
A newly created Saved Worksheet with no selected Sections. Creating one does not
copy the current Anonymous Worksheet or another Saved Worksheet unless a future
feature explicitly adds copy behavior.
_Avoid_: Save current worksheet, duplicate worksheet, import worksheet

**Active Saved Worksheet**:
The Saved Worksheet currently selected for a signed-in user within a supported
term. The planner may remember the last Active Saved Worksheet per term, falling
back to the term's Main Worksheet if the remembered worksheet no longer exists.
_Avoid_: Global active worksheet, cross-term worksheet, browser-only ownership

**Saved Worksheet Management**:
The signed-in user experience for finding, selecting, renaming, deleting, and
distinguishing persisted Saved Worksheets after the initial save and restore
path exists.
_Avoid_: Initial save slice, automatic sync, Local Worksheet import prompt,
worksheet sharing, wishlist

**Saved Search**:
A signed-in user's persisted catalog search text and filter state that can be restored as catalog URL/filter state.
_Avoid_: Anonymous search, availability alert, enrollment alert
