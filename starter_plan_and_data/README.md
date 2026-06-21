# Starter Plan And Data Index

Status: current-vs-historical seam for starter planning inputs.

This folder is not a single source of truth. It contains active planning docs,
completed MVP planning records, original research notes, and source data sheets.
Preserve historical files in place unless a later cleanup intentionally updates
all references.

## Current Working Inputs

- `post_mvp_roadmap.md`: current roadmap order, scope boundaries, and links for
  post-MVP work.
- `mvp1_spec.md`: completed MVP-1 execution specification. Use it as the
  reference for MVP-1 behavior and data contracts.
- `mvp1_prd.md`: completed MVP-1 product requirements. Use it for product
  context when interpreting MVP-1 behavior.

## Historical Planning Inputs

- `ucsd_coursetable_plan.md`: original UCSD CourseTable adaptation plan and
  earlier planning context.
- `interview_notes_static_catalog_vs_graphql.md`: earlier interview/planning
  notes for the static catalog versus GraphQL direction.
- `sheet.csv` and `sheet_gid0.csv`: source planning/data sheets.

## Where New Planning Docs Go

- Use `starter_plan_and_data/post_mvp_roadmap.md` for roadmap sequence, scope
  boundaries, and links only.
- Put issue-sized validation plans, acceptance records, and runbooks in focused
  dated docs under `docs/`.
- Put durable decisions in `docs/adr/`.
- Put shared domain language in `CONTEXT.md`.

Avoid appending detailed beta notes to the roadmap when a focused doc would be
clearer. If an old planning file appears stale, add a new dated note or pointer
instead of rewriting historical context in place.
