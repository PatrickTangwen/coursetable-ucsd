# Planning Index

Status: current-vs-historical seam for planning inputs.

This folder contains active planning docs, completed MVP planning records,
original research notes, and source data sheets. Preserve historical files in
place unless a later cleanup intentionally updates all references.

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
- `mvp-1-spec.md`: completed MVP-1 execution specification. Use it as the
  reference for MVP-1 behavior and data contracts.
- `mvp-1-prd.md`: completed MVP-1 product requirements. Use it for product
  context when interpreting MVP-1 behavior.

## Archived Milestone Docs

Completed beta and MVP milestone docs, moved here from `docs/` top level:

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
  dated docs under `docs/`.
- Put durable decisions in `docs/adr/`.
- Put shared domain language in `CONTEXT.md`.

Avoid appending detailed beta notes to the roadmap when a focused doc would be
clearer. If an old planning file appears stale, add a new dated note or pointer
instead of rewriting historical context in place.
