# Documentation Index

Status: top-level navigation for stable project documentation.

## Current SunGrid References

- `api.md`: API reference.
- `app_db_migrations.md`: versioned App DB migration generation and shared
  staging/production rollout.
- `core_app_backend.md`: Core App Backend composition boundary, optional legacy
  modules, and disposable validation path.
- `course_data_store.md`: shadow Course Data Store ownership, migrations,
  importer, Hasura metadata, and tracer validation.
- `local_server.md`: local frontend/backend/auth startup and login smoke
  runbook.
- `local_server_endpoints.md`: current local frontend/backend URLs, Docker
  containers, HTTPS certificates, and `mkcert` notes.
- `local_course_data_platform.md`: complete disposable App Backend + Course Data
  Platform operator workflow and staging-readiness contract.
- `hosted-auth-security-2026-07-10.md`: hosted verification proxy trust,
  abuse-control budgets, and ambiguous-delivery behavior.
- `hosted-like-auth-validation-2026-07-10.md`: fake-sender, production-mode
  acceptance path for hosted login.
- `locations.md`: location data notes.
- `maintenance.md`: maintenance notes.
- `snapshot_pipe.md`: catalog snapshot pipeline notes, including General Catalog
  enrichment, Schedule parser edge cases, and raw HTML replay rules.
- `styling.md`: styling conventions.

## Inherited CourseTable References

These documents are retained for historical comparison and audit. They describe
upstream CourseTable systems and are not current SunGrid operating runbooks.

- `containers.md`: inherited CourseTable container and database architecture.
  The SunGrid boundary and UCSD adaptation are tracked by GitHub issues #87 and
  #88-#96.
- `graphql.md`: inherited Ferry/Hasura GraphQL integration. The planned UCSD
  Course Data Platform remains a shadow data path until its parity work is
  complete.
- `deployment.md`: inherited `coursetable.com`, Doppler, and self-hosted runner
  deployment notes; do not use it to deploy SunGrid.
- `challenge.md`: inherited CourseTable challenge/context notes.

## Planning And Decisions

- `planning/README.md`: planning archive index and guidance for where current
  planning work now lives.
- `adr/README.md`: decision-record index and ADR editing rules.
