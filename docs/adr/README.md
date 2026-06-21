# ADR Index

Status: module boundary for architecture decision records.

ADRs record durable decisions and their trade-offs. They should stay small
enough to scan quickly and should point to detailed validation plans, runbooks,
or acceptance records instead of duplicating them.

## ADR Interface

An ADR should answer:

- What decision was made.
- Why the decision exists.
- What scope it applies to.
- What trade-offs or consequences matter later.
- Where detailed execution or validation docs live, when those details exist.

Avoid putting command runbooks, issue checklists, per-run evidence, screenshots,
logs, or transient setup notes directly in ADRs.

## Existing Records

- `0001-catalog-snapshot-for-mvp-1.md`: catalog snapshot approach for MVP-1.
- `0002-file-first-mvp-with-deferred-persistence.md`: file-first MVP with
  deferred persistence.
- `0003-instructor-grade-archive-for-historical-gpa.md`: instructor grade
  archive as the historical GPA source.
- `0004-exclude-availability-and-demand-data.md`: exclusion of availability and
  demand data.
- `0005-fail-hard-snapshot-generation.md`: fail-hard snapshot generation.
- `0006-hard-disable-inherited-ui-before-deleting-backend-surfaces.md`: hard
  disable inherited UI before deleting reusable backend surfaces.
- `0007-email-verification-for-first-ucsd-auth.md`: UCSD email verification as
  the first auth path.
- `0008-internal-user-id-for-app-db-ownership.md`: internal app user ID for App
  DB ownership.
- `0009-stage-real-backend-auth-validation-before-email-delivery.md`: validate
  the real backend auth path before production-like email delivery.

## Editing Rule

Do not silently rewrite old ADRs as if the original decision changed. If a
decision is superseded, create a new ADR or add a dated note that explains the
newer observed state and links to the detailed planning doc.
