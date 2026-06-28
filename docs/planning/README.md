# Planning Index

Status: navigation aid and current-vs-historical seam for planning inputs.

This folder contains active planning docs, completed MVP planning records,
original research notes, and source data sheets.

## Read Order

For new agent or human planning work, read in this order:

1. `CONTEXT.md` for domain vocabulary and stable product terms.
2. `docs/adr/README.md` for the decision-record boundary, then the ADRs that
   touch the area being changed.
3. This file for current-vs-historical planning inputs.
4. `post-mvp-roadmap.md` for current roadmap order and scope sequencing.
5. GitHub issues for executable implementation slices.
6. Focused validation or acceptance docs in this folder when an issue points to
   them.

## Current Working Inputs

- `sungrid-catalog-redesign-prd.md`: SunGrid Catalog List View & Course Detail
  Modal redesign PRD. Covers data pipeline, design system migration, component
  architecture, and 5-phase implementation sequence.
- `post-mvp-roadmap.md`: current roadmap order, scope boundaries, and links for
  post-MVP work.
- `worksheet-active-term-selector-2026-06-27.md`: PRD for the anonymous Worksheet
  term-selector slice (surface the term selector signed-out, make Worksheet
  Viewed Term sticky/independent, variant-aware empty state).
  Saved-account multi-term unification is deferred to its own slice.
- `saved-multi-term-worksheet-2026-06-27.md`: PRD for the signed-in multi-term
  Saved Worksheet slice (term selector replacing the static badge, silent
  cross-term add routing to the term's Active Saved Worksheet,
  variant-aware empty state, last-viewed-term persistence). Frontend-only; recorded
  by ADR 0015.
- `populate-ucsd-course-data-multi-term-2026-06-26.md`: plan for moving the
  catalog pipeline to a forward-accumulating, all-subject, multi-term archive.
  Read with ADRs 0012–0014.
- `grade-archive-ui-update-2026-06-21.md`: current UI/data contract for
  Average GPA, Record Count, and Past Grades.
- `mvp-1-spec.md`: completed MVP-1 execution specification. Use it as the
  reference for MVP-1 behavior and data contracts.
- `mvp-1-prd.md`: completed MVP-1 product requirements. Use it for product
  context when interpreting MVP-1 behavior.

## Decision Records

See `docs/adr/README.md` for the full ADR index and editing rules.

## Stable Reference Docs

- `docs/api.md`: API reference.
- `docs/graphql.md`: GraphQL reference.
- `docs/containers.md`: container setup and usage.
- `docs/deployment.md`: deployment notes.
- `docs/locations.md`: location data notes.
- `docs/maintenance.md`: maintenance notes.
- `docs/styling.md`: styling conventions.
- `docs/challenge.md`: challenge/context notes.

## Archived Milestone Docs

Completed beta and MVP milestone docs:

- `archive/beta-0-ui-surface-inventory-2026-06-20.md`
- `archive/beta-1-compose-bringup-runbook-2026-06-20.md`
- `archive/beta-1-real-backend-auth-validation-2026-06-20.md`
- `archive/beta-1-save-anonymous-worksheet-to-account-2026-06-21.md`
- `archive/beta-1-saved-worksheet-acceptance-2026-06-21.md`
- `archive/beta-1-saved-worksheet-management-2026-06-22.md`
- `archive/beta-1-saved-worksheet-management-acceptance-2026-06-22.md`
- `archive/mvp-1-non-ui-acceptance-2026-06-20.md`

## Historical Planning Inputs

- `archive/ucsd-coursetable-plan.md`: original UCSD CourseTable adaptation plan
  and earlier planning context.
- `archive/interview-notes-static-catalog-vs-graphql.md`: earlier
  interview/planning notes for the static catalog versus GraphQL direction.
- `source-data/sheet.csv` and `source-data/sheet_gid0.csv`: source
  planning/data sheets.

## Where New Planning Docs Go

- Use `post-mvp-roadmap.md` for roadmap sequence, scope boundaries, and links
  only.
- Put issue-sized validation plans, acceptance records, and runbooks in focused
  dated docs in this folder.
- Put durable decisions in `docs/adr/`. Keep ADRs short: decision, context,
  trade-off, and pointers to detailed docs.
- Put shared domain language in `CONTEXT.md`.
- Do not commit per-run logs, screenshots, evidence JSON, cookie jars, local
  database dumps, or session artifacts by default.
- If a doc appears stale, create a new dated note or section that records the
  discrepancy instead of silently rewriting the historical record.
- When a milestone's acceptance is complete, move its docs to `archive/`.
