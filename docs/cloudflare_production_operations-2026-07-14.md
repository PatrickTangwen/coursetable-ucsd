# Cloudflare Production operations (2026-07-14)

Status: current SunGrid Production state and operator map after issue #86 was
accepted and closed. This document supersedes the launch-status assumptions in
`cloudflare_production_readiness-2026-07-13.md`; that earlier document remains
the historical pre-provisioning and pre-launch contract.

## Current accepted state

- Public origin: `https://sungridplanner.com`.
- Accepted commit: `415cf4197cfdc0063bca62dcdda6a09d933a6ab1`, reachable
  from `main`.
- Issue [#86](https://github.com/PatrickTangwen/coursetable-ucsd/issues/86)
  is closed as completed.
- Public UCSD email login is enabled through the separately approved login
  toggle workflow.
- Public Catalog and anonymous Worksheet remain usable without an account.
- Production App DB migrations, Catalog publication, real-email verification,
  Session restore, Saved Worksheet ownership, logout, application rollback, and
  App DB backup/disposable restore have all been accepted.
- `APP_DB_BACKUP_ENABLED` remains `false`; scheduled Production backups are not
  currently running.
- The maintainer explicitly waived the remaining forty-eight-hour observation
  gate. Continued post-launch observation is recommended but is not an open
  launch blocker.

## Isolated Production boundary

Production does not borrow Staging state. It uses separately provisioned
resources and protected `Production` Environment values:

- a Production-only Cloudflare Worker and custom-domain route;
- private Production Catalog and App DB backup R2 buckets with separate
  bucket-scoped credentials;
- a Production-only Hyperdrive configuration with caching disabled and TLS
  required;
- a separate Neon project, `sungrid-production`, with database `sungrid` and
  distinct runtime, migration, and backup roles;
- a separate Upstash Redis database for hosted Sessions and verification
  limits;
- a Production-specific Resend key and verified sender domain;
- separate Session, telemetry, deployment, and backup credentials.

Runtime App DB requests use the `APP_DB_HYPERDRIVE_NO_CACHE` binding. Migrations
and logical backups connect directly to Neon through separate protected GitHub
Environment secrets. Hyperdrive is the runtime connection layer, not the
database itself.

## Accepted Production evidence

| Gate                                 | Evidence                                                                                                           | Accepted result                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Staging-accepted commit              | [Staging run 29298271623](https://github.com/PatrickTangwen/coursetable-ucsd/actions/runs/29298271623)             | `success` at the Production commit                                                                                                 |
| Login-disabled Production deployment | [Production run 29298806734](https://github.com/PatrickTangwen/coursetable-ucsd/actions/runs/29298806734)          | `success`; migration, Catalog publication, Worker deployment, disabled-login smoke, and accepted evidence completed                |
| Deliberate public-login enable       | [Toggle run 29299283486](https://github.com/PatrickTangwen/coursetable-ucsd/actions/runs/29299283486)              | `success`; fresh maintainer approval was verified before deployment                                                                |
| Real App DB backup and restore       | [Backup run 29303511779](https://github.com/PatrickTangwen/coursetable-ucsd/actions/runs/29303511779)              | `success`; private Production backup was restored and checked in disposable PostgreSQL                                             |
| Application rollback drill           | [Rollback run 29303575008](https://github.com/PatrickTangwen/coursetable-ucsd/actions/runs/29303575008)            | Expected overall `failure`; hosted smoke passed, failure was deliberately injected, and the last accepted deployment was restored  |
| Real-email and account flow          | [Issue #86 final acceptance](https://github.com/PatrickTangwen/coursetable-ucsd/issues/86#issuecomment-4965192626) | Email delivery and verification, Session reload, Saved Worksheet persistence/cleanup, and logout passed without sensitive evidence |

The red rollback-drill conclusion is not an unresolved outage. The workflow is
designed to fail after a successful smoke so that its automatic restoration
path is exercised and auditable.

## Production workflow map

### Login-disabled deployment

Workflow:
[`cloudflare-production-deploy.yml`](../.github/workflows/cloudflare-production-deploy.yml)

This is a manual workflow. It accepts only a full commit reachable from `main`,
requires it to equal the protected `STAGING_ACCEPTED_COMMIT`, runs repository
and hosted-boundary checks, applies forward-only App DB migrations, publishes
the private Catalog, builds with login disabled, deploys, smokes, and records
the accepted Worker. A failed protected deployment restores the prior accepted
Worker and Catalog evidence.

This workflow is not the path for enabling public login. It always builds and
deploys the disabled state.

Current constraint: the deployment job explicitly requires
`APP_DB_BACKUP_ENABLED=false`. Turning scheduled backup on before that
first-deployment guard is revised will make later Production deploys fail at
the guard step.

### Public-login toggle

Workflow:
[`cloudflare-production-login-toggle.yml`](../.github/workflows/cloudflare-production-login-toggle.yml)

This manual workflow changes only the approved public-login state on the
durable accepted commit. `disabled` is the default and immediate feature-flag
rollback path. Each dispatch requires a fresh `OWNER` comment on issue #86 with
the exact approval line and an `issue-86-comment-NNN` identifier newer than the
last accepted Production evidence.

Issue #86 is closed but not locked, so the current workflow contract can still
read a new approval comment. The hard-coded issue dependency should be revised
before the project adopts a different incident or release-approval record.

### App DB backup and disposable restore

Workflow:
[`app-db-backup-production.yml`](../.github/workflows/app-db-backup-production.yml)

Manual dispatch always runs. The declared schedule is `08:47 UTC` daily, but a
scheduled event runs the job only when the protected Production variable
`APP_DB_BACKUP_ENABLED` is exactly `true`.

Each accepted run:

1. prepares the least-privilege Neon backup role;
2. creates a PostgreSQL 18 custom-format logical dump;
3. publishes the dump and manifest under `production/app-db/` in the private
   Production backup bucket;
4. applies the seven-daily plus four-weekly retention policy;
5. downloads the accepted artifact, restores it into disposable PostgreSQL,
   verifies the schema and key tables, and removes the disposable resources.

The workflow proves that a backup artifact is recoverable. It does not perform
an in-place restore over the live Production database. A destructive Production
recovery requires a separate incident decision, target database, and reviewed
restore procedure.

## Standard release sequence

1. Land the candidate on `main` and accept the exact commit through the Staging
   workflow and hosted smoke.
2. Update the protected `STAGING_ACCEPTED_COMMIT` only after reviewing Staging
   evidence.
3. Dispatch the login-disabled Production deployment for that exact commit and
   review migration, Catalog, Worker, smoke, privacy, and accepted-deployment
   evidence.
4. Post a fresh maintainer approval record and use the login-toggle workflow
   only when the intended public state should change.
5. Run a privacy-safe public smoke. Never post a complete email, verification
   code, Cookie, connection string, private mailbox screenshot, raw database
   row, or raw sensitive log.

## Rollback and recovery boundaries

- To hide new public login immediately, dispatch the login-toggle workflow with
  `desired_state=disabled` and a fresh exact maintainer approval comment.
- A failed deployment or login toggle automatically attempts to restore the
  last accepted Worker and Catalog evidence.
- Production database schema changes are forward-only. Application rollback
  must remain compatible with the expanded schema; workflows do not run a down
  migration.
- The deliberate rollback input is an acceptance drill, not a routine release
  mechanism. Its overall run is expected to be red after the successful smoke.
- Backup restore verification is disposable. Do not point its restore URL at
  the live Production App DB.

## Open operations work

The launch is accepted, but these non-blocking operations items remain:

1. Decouple the Production deployment workflow from the permanent
   `APP_DB_BACKUP_ENABLED=false` first-deployment guard before enabling the
   daily backup schedule.
2. Assign backup-failure notification ownership. GitHub Actions records failed
   runs, but the repository does not currently define a dedicated external
   paging or messaging channel for Production backup failures.
3. After items 1 and 2 are accepted, set `APP_DB_BACKUP_ENABLED=true`, observe
   the first scheduled run, and confirm retention without exposing object names
   or database contents.
4. Continue post-launch review of login failures, Resend delivery, Worker
   errors, Neon/Hyperdrive availability, Upstash usage, R2 usage, and provider
   cost alerts. This is operational observation, not a reinstatement of the
   waived launch gate.

Any provider credential rotation, live database restore, plan change, cost-cap
change, DNS mutation, or Production login-state change remains a separate
maintainer-authorized action.
