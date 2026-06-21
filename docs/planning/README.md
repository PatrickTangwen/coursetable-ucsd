# Planning Index

Status: current-vs-historical seam for planning inputs.

This folder contains active planning docs, completed MVP planning records,
original research notes, and source data sheets. Preserve historical files in
place unless a later cleanup intentionally updates all references.

## Current Working Inputs

- `post-mvp-roadmap.md`: current roadmap order, scope boundaries, and links for
  post-MVP work.
- `mvp-1-spec.md`: completed MVP-1 execution specification. Use it as the
  reference for MVP-1 behavior and data contracts.
- `mvp-1-prd.md`: completed MVP-1 product requirements. Use it for product
  context when interpreting MVP-1 behavior.

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
