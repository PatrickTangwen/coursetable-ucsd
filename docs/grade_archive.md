# Grade Archive And Past Grades

Status: current SunGrid contract for historical grade data, Published Snapshot
matching, and Past Grades display.

## Source and row identity

UCSD's Instructor Grade Archive is SunGrid's primary Historical GPA Data source.
Each Grade Archive Record retains its source `subject`, `course`, `year`,
`quarter`, `instructor`, GPA, grade-bucket percentages, and raw source cells.
The Published Snapshot remains the Catalog source of truth.

An exact canonical Course ID match is always preferred. Exact records are never
combined with records reached through another listing.

## Explicit cross-listed matching

A course with no exact Grade Archive Records may inherit rows from another
listing only when all of these conditions hold:

1. Its General Catalog description explicitly says
   `Cross-listed with SUBJECT NUMBER`.
2. Both listings have a current-term scheduled offering.
3. At least one target/source section pair has the same normalized instructor
   and the same non-Final meeting days, time, building, and room.
4. Exactly one qualifying cross-listed source has Grade Archive Records.

If the evidence is missing, mismatched, or ambiguous, Past Grades remains
unavailable. Course-title similarity is never a match key. `May be coscheduled
with` does not qualify because undergraduate and graduate grading populations
can differ.

Inherited rows preserve their original source fields and add:

```json
{
  "matched_via": "cross_listed"
}
```

The Past Grades UI displays the source listing, for example:

```text
Historical records shown from cross-listed GLBH 129.
```

## Fall 2026 accepted matches

The 2026-07-21 FA26 snapshot contains two accepted inherited matches:

| Target course | Archive source | Rows | Evidence                                                  |
| ------------- | -------------- | ---: | --------------------------------------------------------- |
| `ANSC:129`    | `GLBH:129`     |    1 | Explicit cross-list; matching FA26 instructor and meeting |
| `ETHN:133`    | `TDHT:111`     |    3 | Explicit cross-list; matching FA26 instructor and meeting |

`SE:263` / `SE:163` and `USP:271` / `USP:171` remain unavailable because the
Catalog describes them only as coscheduled. The accepted enrichment reduced
FA26 courses without Past Grades from 832 to 830 without changing Course,
description, or Section content.

## Verification

The durable checks are:

```sh
bun run typecheck
bun run test:snapshot
bun run --cwd frontend test
bun run validate:worker-catalog
```

Browser acceptance should verify both the inherited row count and the visible
cross-listed source note in the Past Grades tab. See `snapshot_pipe.md` for
generation and Import Manifest behavior.

## Course Data Store boundary

The static Published Snapshot and frontend preserve and display
`matched_via: "cross_listed"`. The shadow Course Data Store currently retains
the target Course ID and the archive row's original subject/course fields, but
does not persist the explicit `matched_via` field. This is a known parity gap;
do not claim cross-listed provenance parity through Hasura until that field or
an equivalent structured relationship is stored and validated.
