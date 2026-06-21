# Planning Docs Index

Status: navigation aid for current planning docs.

This file maps the current planning and decision documents for the UCSD Course
Planning Platform. It does not replace the referenced docs; use it to find the
right source before editing or starting implementation.

## Read Order

For new agent or human planning work, read in this order:

1. `CONTEXT.md` for domain vocabulary and stable product terms.
2. `docs/adr/` for durable decisions and their trade-offs.
3. `starter_plan_and_data/post_mvp_roadmap.md` for current roadmap order and
   scope sequencing.
4. GitHub issues for executable implementation slices.
5. Focused validation or acceptance docs under `docs/` when an issue points to
   them.

## Active Planning Docs

- `starter_plan_and_data/post_mvp_roadmap.md`: current post-MVP roadmap and
  issue sequencing. Keep this as a compact map, not a place for detailed
  issue-level notes.
- `docs/beta-1-real-backend-auth-validation-2026-06-20.md`: focused plan for
  issue #20, `Beta-1: Real Backend Auth Validation`.
- `docs/beta-0-ui-surface-inventory-2026-06-20.md`: current Beta-0 UI surface
  inventory.
- `docs/mvp-1-non-ui-acceptance-2026-06-20.md`: MVP-1 non-UI acceptance record.
- `CONTEXT.md`: shared domain terms and project language.

## Decision Records

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

## Stable Reference Docs

- `starter_plan_and_data/mvp1_prd.md`: MVP-1 product requirements.
- `starter_plan_and_data/mvp1_spec.md`: MVP-1 implementation specification.
- `docs/api.md`: API reference.
- `docs/graphql.md`: GraphQL reference.
- `docs/containers.md`: container setup and usage.
- `docs/deployment.md`: deployment notes.
- `docs/locations.md`: location data notes.
- `docs/maintenance.md`: maintenance notes.
- `docs/styling.md`: styling conventions.
- `docs/challenge.md`: challenge/context notes.

## Historical Planning Inputs

- `starter_plan_and_data/ucsd_coursetable_plan.md`: earlier UCSD CourseTable
  adaptation plan.
- `starter_plan_and_data/interview_notes_static_catalog_vs_graphql.md`: earlier
  planning notes on static catalog versus GraphQL direction.
- `starter_plan_and_data/sheet.csv` and `starter_plan_and_data/sheet_gid0.csv`:
  source planning/data sheets.

## How To Add Planning Notes

- Keep `starter_plan_and_data/post_mvp_roadmap.md` focused on roadmap order,
  scope boundaries, and links.
- Put issue-sized validation plans, acceptance records, and runbooks in focused
  dated docs under `docs/`.
- Keep ADRs short: decision, context, trade-off, and pointers to detailed docs.
- Do not commit per-run logs, screenshots, evidence JSON, cookie jars, local
  database dumps, or session artifacts by default.
- If a doc appears stale, create a new dated note or section that records the
  discrepancy instead of silently rewriting the historical record.
