# Documentation Index

Status: top-level navigation for stable project documentation.

## Current SunGrid References

- `api.md`: API reference.
- `app_db_migrations.md`: versioned App DB migration generation and shared
  staging/production rollout.
- `app_db_backup_recovery-2026-07-11.md`: forward migration, private App DB
  backup retention, and disposable restore proof for hosted staging.
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
- `email_delivery_audit_privacy-2026-07-11.md`: maintainer-only delivery audit,
  seven-day cleanup, and hosted telemetry/evidence privacy rules.
- `hosted-like-auth-validation-2026-07-10.md`: fake-sender, production-mode
  acceptance path for hosted login.
- `hosted_failure_cost_safety-2026-07-12.md`: hosted provider-failure
  boundary, Application Safety Budget, usage signals with 70/90 percent
  thresholds, and failure/rollback evidence.
- `cloudflare_hosted_staging.md`: proposed Cloudflare Worker staging boundary,
  external state services, security and cost policies, and acceptance gate.
- `cloudflare_staging_deployment-2026-07-12.md`: manual, protected staging
  deployment workflow, rollback behavior, and non-sensitive evidence contract.
- `cloudflare_production_readiness-2026-07-13.md`: code-only Production
  workflow, isolation inputs, login-disabled first deployment, and human-owned
  provisioning gates.
- `worker_catalog.md`: local single-origin Worker Catalog, private R2
  publication integrity, and disposable acceptance workflow.
- `worker_login.md`: Hyperdrive, Upstash REST, fixed hosted sessions, and
  direct Neon migration separation.
- `worker_planning_data.md`: Worker Saved Search and Saved Worksheet ownership,
  shared HTTP contract, and account-service failure isolation.
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
