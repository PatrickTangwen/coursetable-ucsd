# Cloudflare staging deployment workflow (2026-07-12)

Status: repository implementation for issue #117. The workflow is intentionally
manual and cannot run until this file is reachable from the default branch. This
document does not report a hosted deployment or authorize production changes.

## Trigger and trust boundary

`.github/workflows/cloudflare-staging-deploy.yml` exposes only
`workflow_dispatch`. The maintainer must select the `staging` target and a full
commit SHA. A credential-free preflight checks out that commit, fetches
`origin/main`, proves the selected commit is reachable from `main`, runs the
repository checks, and validates the deployment contract.

The deployment job runs only when the workflow itself was dispatched from
`main`. It targets the protected GitHub `Staging` Environment, so its provider
and runtime secrets remain unavailable until the configured maintainer review
has completed. Pull-request jobs never receive these secrets.

## Ordered deployment

The protected job performs these stages in order:

1. Capture the current 100-percent-traffic Worker version, or record that this
   is the first deployment.
2. Apply forward-only Drizzle migrations through the dedicated
   `NEON_MIGRATION_DATABASE_URL`. App DB backup continues to use the separate
   `NEON_DIRECT_DATABASE_URL`.
3. Rebuild the Supported Term registry from every paired, validated repository
   Published Snapshot and Import Manifest. Upload content-addressed objects to
   private Standard R2, read each object back, verify its SHA-256 digest, and
   switch `metadata.json` only after all objects pass.
4. Generate the staging-only Wrangler configuration from protected
   non-sensitive inputs, build the frontend, enforce the 20,000-static-asset
   Free limit, and perform a strict dry run.
5. Deploy the Worker, static assets, custom domain, bindings, and runtime
   secrets in one Wrangler deployment. `workers.dev` and preview URLs remain
   disabled; the only configured public ingress is
   `staging.sungridplanner.com`.
6. Repeat public Catalog and unauthenticated auth/Session/account-route smokes
   at least three times. The smoke fails on unexpected status, provider-default
   URLs, or Cloudflare CPU/resource-limit responses and never creates or
   bypasses a Verified UCSD Email identity.
7. Read Cloudflare state back through the minimally scoped deployment token.
   The workflow blocks the Paid `standard` Worker usage model and combines the
   non-Standard account setting with #84's accepted human Free-plan evidence;
   it also proves Worker development and preview URLs are off, account Cron
   Triggers remain within five, R2 is private Standard storage, and Hyperdrive
   caching is disabled within the Free connection limit. The more direct
   subscriptions endpoint is intentionally not used because it would require
   expanding the deployment token with Billing Read.
8. Persist a non-sensitive, digest-verified deployment record containing the
   Git commit, Worker version, frontend build identity, App DB schema version,
   active Published Snapshot and archive digests, timestamp, Workers Free
   identity, limit evidence, and smoke evidence. The accepted record becomes
   `deployment-evidence/last-accepted.json` in private Catalog R2.

## Safe failure and rollback

Checks and migration failures stop before public deployment. Content-addressed
R2 objects may remain after an interrupted publication, but they are not
current until the metadata pointer changes. A later failure restores the prior
metadata pointer and verifies it by digest.

If a prior Worker version existed, failure after a deployment attempt rolls
traffic back to that exact version and verifies it is again receiving 100
percent. If the first Worker deployment fails, the workflow deletes that first
Worker so no unaccepted Custom Domain or provider-default surface remains. The
final job summary reports the last accepted deployment, or `none` before the
first acceptance.

## Remaining human acceptance

Issue #85 owns real UCSD mailbox delivery, code verification, fixed Session
restore/logout, Saved Search and Saved Worksheet ownership, provider failure
drills, backup restore, and the forty-eight-hour observation window. The #117
automated smoke deliberately does not manufacture a verified account to claim
that evidence.

`APP_DB_BACKUP_ENABLED=false` remains required until migration, the first
accepted deployment, and the restore verification are all accepted. The #117
workflow neither changes that variable nor creates or mutates production
resources.
