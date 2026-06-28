# Planning Docs Index

Status: navigation aid for current planning docs.

This file maps the current planning and decision documents for the UCSD Course
Planning Platform. It does not replace the referenced docs; use it to find the
right source before editing or starting implementation.

## Read Order

For new agent or human planning work, read in this order:

1. `CONTEXT.md` for domain vocabulary and stable product terms.
2. `docs/adr/README.md` for the decision-record boundary, then the ADRs that
   touch the area being changed.
3. `docs/planning/README.md` for current-vs-historical planning inputs.
4. `docs/planning/post-mvp-roadmap.md` for current roadmap order and scope
   sequencing.
5. GitHub issues for executable implementation slices.
6. Focused validation or acceptance docs under `docs/` when an issue points to
   them.

## Active Planning Docs

- `docs/planning/post-mvp-roadmap.md`: current post-MVP roadmap and issue
  sequencing. Keep this as a compact map, not a place for detailed issue-level
  notes.
- `docs/planning/README.md`: current-vs-historical seam for planning inputs.
- `docs/populate-ucsd-course-data-multi-term-2026-06-26.md`: plan for moving the
  catalog pipeline to a forward-accumulating, all-subject, multi-term archive,
  with the source-availability finding and dependency-ordered implementation
  slices. Read with ADRs 0012–0014.
- `docs/grade-archive-ui-update-2026-06-21.md`: current UI/data contract for
  Average GPA, Record Count, and Past Grades.
- `CONTEXT.md`: shared domain terms and project language.

## Decision Records

- `docs/adr/README.md`: ADR module boundary and index.
- `docs/adr/0001-catalog-snapshot-for-mvp-1.md`: catalog snapshot approach for
  MVP-1.
- `docs/adr/0002-file-first-mvp-with-deferred-persistence.md`: file-first MVP
  and deferred persistence.
- `docs/adr/0003-instructor-grade-archive-for-historical-gpa.md`: historical
  GPA source decision.
- `docs/adr/0004-exclude-availability-and-demand-data.md`: exclusion of
  availability and demand data.
- `docs/adr/0005-fail-hard-snapshot-generation.md`: fail-hard snapshot
  generation.
- `docs/adr/0006-hard-disable-inherited-ui-before-deleting-backend-surfaces.md`:
  inherited CourseTable UI surface handling.
- `docs/adr/0007-email-verification-for-first-ucsd-auth.md`: email
  verification for the first UCSD auth path.
- `docs/adr/0008-internal-user-id-for-app-db-ownership.md`: internal app user
  IDs for database ownership.
- `docs/adr/0009-stage-real-backend-auth-validation-before-email-delivery.md`:
  stage real backend auth validation before email delivery.
- `docs/adr/0010-reuse-worksheet-management-interface-with-saved-worksheet-model.md`:
  reuse the original worksheet management interface pattern while keeping UCSD
  Saved Worksheet data ownership separate from legacy worksheet-number APIs.
- `docs/adr/0011-introduce-snapshot-static-availability-data.md`: enrolled,
  capacity, and waitlist as snapshot-static section fields, superseding ADR 0004.
- `docs/adr/0012-forward-accumulating-term-archive-bounded-by-source.md`:
  multi-term depth via forward accumulation bounded by the UCSD source window;
  pre-window history (2021) delivered only as Historical GPA.
- `docs/adr/0013-per-cell-partial-snapshot-with-import-manifest.md`: per-cell
  partial-tolerant snapshot generation with an auditable Import Manifest,
  superseding the global fail-hard rule of ADR 0005.
- `docs/adr/0014-multi-term-display-semantics.md`: term-state availability
  staleness and no single course-level GPA summary, refining ADR 0011 and
  superseding the Average GPA card of ADR 0003.

## Stable Reference Docs

- `docs/planning/mvp-1-prd.md`: MVP-1 product requirements.
- `docs/planning/mvp-1-spec.md`: MVP-1 implementation specification.
- `docs/api.md`: API reference.
- `docs/graphql.md`: GraphQL reference.
- `docs/containers.md`: container setup and usage.
- `docs/deployment.md`: deployment notes.
- `docs/locations.md`: location data notes.
- `docs/maintenance.md`: maintenance notes.
- `docs/styling.md`: styling conventions.
- `docs/challenge.md`: challenge/context notes.

## Archived Milestone Docs

Completed beta and MVP milestone docs live in `docs/planning/archive/`. These
are preserved as historical records; they should not be used as current planning
inputs.

- `docs/planning/archive/beta-0-ui-surface-inventory-2026-06-20.md`: Beta-0 UI
  surface inventory and acceptance evidence.
- `docs/planning/archive/beta-1-compose-bringup-runbook-2026-06-20.md`: issue
  #21 runbook for Doppler-free local backend validation.
- `docs/planning/archive/beta-1-real-backend-auth-validation-2026-06-20.md`:
  issue #20 validation plan for real backend auth.
- `docs/planning/archive/beta-1-save-anonymous-worksheet-to-account-2026-06-21.md`:
  completed transitional save/restore slice; superseded by the Saved Worksheet
  Management PRD.
- `docs/planning/archive/beta-1-saved-worksheet-acceptance-2026-06-21.md`:
  acceptance record for issue #26 and parent PRD #24.
- `docs/planning/archive/beta-1-saved-worksheet-management-2026-06-22.md`:
  completed PRD for Saved Worksheet Management.
- `docs/planning/archive/beta-1-saved-worksheet-management-acceptance-2026-06-22.md`:
  acceptance record for issue #34 and final interaction-alignment follow-up.
- `docs/planning/archive/mvp-1-non-ui-acceptance-2026-06-20.md`: MVP-1 non-UI
  acceptance record.

## Historical Planning Inputs

- `docs/planning/archive/ucsd-coursetable-plan.md`: earlier UCSD CourseTable
  adaptation plan.
- `docs/planning/archive/interview-notes-static-catalog-vs-graphql.md`: earlier
  planning notes on static catalog versus GraphQL direction.
- `docs/planning/source-data/sheet.csv` and
  `docs/planning/source-data/sheet_gid0.csv`:
  source planning/data sheets.

## How To Add Planning Notes

- Keep `docs/planning/post-mvp-roadmap.md` focused on roadmap order, scope
  boundaries, and links.
- Put issue-sized validation plans, acceptance records, and runbooks in focused
  dated docs under `docs/`.
- Keep ADRs short: decision, context, trade-off, and pointers to detailed docs.
- Do not commit per-run logs, screenshots, evidence JSON, cookie jars, local
  database dumps, or session artifacts by default.
- If a doc appears stale, create a new dated note or section that records the
  discrepancy instead of silently rewriting the historical record.
- When a milestone's acceptance is complete, move its docs to
  `docs/planning/archive/`.
