# UCSD Course Planning Platform

Domain language for the UCSD course discovery and schedule planning platform built from a CourseTable fork.

## Language

**MVP-1**:
The first releasable version of the platform, focused on public course discovery and anonymous schedule planning.
_Avoid_: Full MVP, beta, logged-in MVP

**Beta-0 UI Surface Cleanup**:
The first post-MVP implementation slice, focused on removing inherited CourseTable/Yale product surfaces from public UCSD catalog and worksheet paths before adding signed-in persistence.
_Avoid_: Auth beta, persistence beta, full redesign

**Beta-1 Real Backend Auth Validation**:
The post-Auth Foundation validation slice that proves UCSD User Identity and App DB ownership against the app's real local backend services before production-like email delivery.
_Avoid_: Email delivery beta, hosted staging rollout, new product capability

**Beta-1 Save Anonymous Worksheet To Account**:
The post-auth product slice where a signed-in user explicitly turns an Anonymous Worksheet into a Saved Worksheet.
_Avoid_: Automatic save on login, implicit worksheet sync, auth validation

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

**Archive Avg GPA**:
The unweighted mean GPA across matching Grade Archive Records.
_Avoid_: Weighted GPA, course rating, sample-size-adjusted GPA

**Record Count**:
The number of Grade Archive Records used in an archive-derived GPA summary.
_Avoid_: Student count, sample size, enrollment

**Availability Data**:
Dynamic seat, capacity, waitlist, enrollment, or demand data that the platform intentionally excludes from product features.
_Avoid_: Open seats, seat availability, enrollment tracker, demand signal

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

**Worksheet**:
A student-selected set of course sections for planning a schedule within a term.
_Avoid_: Cart, schedule cart, saved schedule

**Anonymous Worksheet**:
A worksheet that belongs only to the current browser/session and is not attached to a user account.
_Avoid_: Saved worksheet, server worksheet, account worksheet

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

**Saved Search**:
A signed-in user's persisted catalog search text and filter state that can be restored as catalog URL/filter state.
_Avoid_: Anonymous search, availability alert, enrollment alert
