# Preserve TSS Package Identity At An Attended Capture Boundary

Status: accepted. Refines ADR 0036 for authenticated FA26 Schedule capture.

## Decision

SunGrid uses the authenticated TSS Schedule OData service as a source seam only
through an attended, read-only capture boundary. A maintainer completes normal
SSO/Duo in a dedicated local browser profile. The capture selects only approved
course Schedule fields, sanitizes responses in memory, and persists only a
strict `tss-schedule-v1` artifact. It does not export cookies, persist raw
authenticated responses, disable TLS verification, retry access restrictions,
or observe unrelated OData traffic.

`tss-schedule-v1` models the TSS event package as the enrollable section. The
source package object ID remains the section identity, and every package keeps
its own references to source Event IDs. Shared events are not globally deduped,
and the adapter does not invent WebReg A/B or A01/A50 identifiers.

The Published Snapshot and frontend may carry TSS source package status,
disabled state, exact section/Event identifiers, delivery mode, notes,
requirements, units, and meeting modality when those values pass the source
allowlist. Student records, instructor email, and employee identifiers are not
part of this contract.

Package status text is display-only. Semantic behavior uses the allowlisted
Event status and the package `disabled` boolean; free-form package text cannot
enable or disable a choice.

## Constraints

- The first term mapping is explicit: FA26 is TSS academic year `2026`, period
  `2`. Any row outside that mapping fails capture.
- Unknown source fields, status values, schedule display grammar, pagination
  shapes, or package-level conflicts fail closed.
- Browser caching, service workers, and redirects are disabled for authenticated
  OData requests, and hard page/row budgets cap a capture run.
- Capture time and source freshness remain separate. A missing source-declared
  freshness value stays `null` with `unavailable` provenance and cannot be
  replaced with local capture time or arbitrary text.
- Complete coverage requires source-declared module/event totals, exhausted
  continuation, requested-subject empty/non-empty accounting, and explicit
  captured/not-captured coverage for Schedule UI fields.
- A working authenticated endpoint does not itself grant authorization to
  automate capture or republish UCSD data.

## Consequences

SunGrid can reuse the useful endpoint and data-model reconnaissance from the
MIT-licensed WebReg Course Planner without inheriting its unsafe session/raw
data handling or its lossy importer. The schema now corresponds to TSS package
and component topology, but Production release remains gated on live query,
freshness, authorization, and UI-parity evidence.

Operational details and the upstream assessment live in `docs/snapshot_pipe.md`
and
`docs/planning/archive/tss-webreg-course-planner-assessment-2026-07-21.md`.
