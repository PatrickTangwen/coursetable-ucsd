# Course Data Store

Status: stable architecture and first term-and-course tracer reference.

The Course Data Store is a separately owned Postgres database for public UCSD
course data and import provenance. It is not the App DB: App Users, email
verification records, Saved Searches, and Saved Worksheets are never migrated
into or exposed from this database.

The Published Snapshot remains SunGrid's Catalog source of truth and the React
frontend continues to use the existing static JSON endpoints. The Course Data
Store and Hasura projection are a shadow validation path.

## Tracer boundary

The tracer imports one validated real Supported Term and its scheduled Course
relationships:

```text
Published Snapshot
  -> UCSD Snapshot Importer
  -> Course Data Store
  -> anonymous read-only Hasura query
```

Course Data Store migrations live under `course-data-store/migrations` and use
their own `course_data_migrations` journal. They do not share the App DB Drizzle
migration journal or command.

The importer preserves the existing `active_planning_term` and `course_id`
values as external identities. It validates the complete Published Snapshot
before connecting to Postgres, records the source run ID, generation time, and
SHA-256 artifact fingerprint, and reports bounded created/unchanged/rejected
counts. Re-importing identical bytes is idempotent.

Until issue #92 adds atomic mutable-term replacement, importing a different
artifact for an already accepted Supported Term fails closed. This prevents a
projection from mixing generations or recording provenance for data that was
not promoted.

Sections use the existing term-scoped Section ID. Meetings retain source order,
nullable times and locations, raw source values, and explicit TBA semantics.
Instructors use the exact normalized Snapshot name available at this stage and
are connected to Sections through a many-to-many join, so team teaching is not
flattened. A Section may own zero, one, or many Meetings.

Committed Hasura metadata lives in `course-data-store/hasura`. Hasura connects
only to the Course Data Store and grants the unauthenticated `anonymous` role
select access to Supported Terms and Courses. The metadata exposes UCSD/SunGrid
names such as `supportedTerms`, `termCode`, `courseId`, and `courseNumber`.
Anonymous select permissions also enforce server-side row limits; the complete
public pagination and term-scoping contract remains owned by issue #94.

## Commands

```sh
COURSE_DATA_STORE_DATABASE_URL=<course-data-postgres-url> \
  bun run course-data:migrate

COURSE_DATA_STORE_DATABASE_URL=<course-data-postgres-url> \
  bun run course-data:import -- api/static/catalogs/public/S326.json

bun run validate:course-data-tracer
```

The disposable tracer starts an isolated Postgres and Hasura stack, applies the
Course Data Store migration, rejects invalid input before mutation, imports the
real S326 Published Snapshot twice, applies metadata, queries as anonymous,
proves App DB tables are unavailable, and checks stable relationship counts.
S326 supplies real one/many-Meeting, TBA, and team-taught evidence. Because no
current Published Snapshot contains a zero-Meeting Section, the validator also
imports an explicitly labelled boundary fixture to prove that cardinality. It
then proves a failed relationship import leaves the accepted projection
readable and removes containers and volumes on success or failure.
