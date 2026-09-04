# ETL Refresh Runbook

Date: 2026-08-05

Status: operations notes for the one-command ETL refresh orchestrator
(ADR 0041). Source behaviors and parser rules stay in `snapshot_pipe.md`.

## One-Command Refresh

```bash
bun run etl:refresh
```

This runs, in order:

1. **Discovery.** Probes the live Schedule of Classes Term Window and the
   Class Planner term registry (`/api/v1/planner/terms`). A term served by
   both sources aborts the refresh before anything is mutated; decide the
   schedule source for that term first (ADR 0040).
2. **Before-state capture.** Copies `api/static/catalogs/public/` into
   `data/reports/etl/<timestamp>/before/` for the refresh report.
3. **Schedule of Classes refresh.** The multi-term pipeline fetches SoC per
   term/subject plus General Catalog and Instructor Grade Archive per
   subject, publishes snapshots, Import Manifests, `metadata.json`, and
   fresh normalized runs under `data/normalized/`.
4. **Class Planner refresh.** For each planner term with data (currently
   FA26): fetch raw pages into `data/raw/classplanner/<TERM>/<timestamp>/`,
   convert to `tss-chatbot-v1`, and publish the TSS snapshot. Running after
   step 3 keeps the term's registry entry active instead of frozen. The
   primary metadata directory is auto-selected as the newest normalized
   multi-run for the Active Planning Term; consolidation across preserved
   runs still happens through the metadata root.
5. **Supported terms.** Rewrites
   `frontend/src/generated/supported-terms.json` from the final registry.
6. **Validators.** `validate:staging-deployment` and
   `validate:production-deployment` (credential-free; structural
   publishability only, not a hosted deployment).
7. **Refresh report.** Diffs before/after published JSON with embedded
   DuckDB (byte-level course digests, so a reported change is a real change)
   and writes `data/reports/etl/<timestamp>/refresh-report.{json,md}`. The
   Markdown table is the intended source for the data commit message.

The run fails fast on any step; nothing falls back silently. Raw pages are
preserved before conversion, so failed runs replay offline.

## What Stays Manual By Design

Reviewing the refresh report, committing the regenerated JSON, merging,
dispatching the Cloudflare staging/production deployments, and Staging
acceptance. See ADR 0041.

## Telemetry

Spans cover discovery, each pipeline, each Class Planner term, validators,
and the report. Export is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://<collector>/v1/traces bun run etl:refresh
```

## Individual Steps

The underlying CLIs remain runnable on their own; see `snapshot_pipe.md`
(Class Planner Catalog Source) for the three-command Class Planner sequence
and the TSS publisher flags.

## Scheduled Runs (ADR 0042)

A launchd agent (`com.sungrid.coursetable-etl`, Monday and Thursday 07:00
local) runs `tools/etl/run-scheduled-refresh.mts`:

1. Resets the dedicated worktree `~/.coursetable-etl/worktree` to
   `origin/main` (the operator's working copy is never touched; the
   worktree's `data/` symlinks to the main clone's durable archive).
2. Installs dependencies and runs `etl:refresh` there.
3. If the refresh report shows no material change (header timestamps alone
   do not count), it exits quietly with a notification and no PR.
4. Otherwise it commits `api/static/catalogs`, `api/static/metadata.json`,
   and `frontend/src/generated/supported-terms.json` to a
   `data-refresh/<date>` branch, pushes that branch (never `main`), and
   opens a review PR with the refresh report as its body.

Because the worktree checks out `origin/main`, the schedule runs merged
pipeline code only: pushing pipeline changes to `main` is what deploys them
to the automation.

Operations:

```bash
bun tools/etl/run-scheduled-refresh.mts   # manual run of the same flow
bun tools/etl/install-launchd.mts         # (re)install the agent
bun tools/etl/install-launchd.mts --uninstall
launchctl kickstart gui/$(id -u)/com.sungrid.coursetable-etl  # run now
```

Logs: `data/logs/refresh.log` and `data/logs/refresh.err.log` in the main
clone (gitignored with the rest of `data/`). Outcomes (PR URL, quiet run,
failure) also arrive as macOS notifications.

After a PR opens, the remaining flow is unchanged and deliberately manual:
review the report in the PR, merge, dispatch `cloudflare-staging-deploy`,
accept Staging, dispatch `cloudflare-production-deploy`.

The hosted alternative (Cloudflare Workers Cron + Workflows) stays deferred
until `data/raw` and `data/normalized` are archived to R2; without that
state a hosted runner cannot consolidate historical normalized metadata.

## Instructor Grade Archive On Demand (2026-09-03, ADR 0045)

Since early September 2026 `qa-as.ucsd.edu/Home/InstructorGradeArchive`
redirects anonymous requests to UCSD Single Sign-On. The signed-in page and
its table are unchanged, but a Single Sign-On session lasts about two hours,
so an unattended run cannot fetch the archive. Schedule of Classes and General
Catalog are unaffected.

`run-refresh.mts --grade-archive <mode>` therefore has two modes:

- **`reuse` (default, what the launchd schedule runs).** No archive request is
  made. Each Configured Subject is served from the newest prior normalized run
  under `data/normalized/` that holds `instructor_grade_archive/<SUBJECT>.json`.
  The Import Manifest cell points at that artifact (so retention keeps the run,
  ADR 0044), the snapshot's `source_timestamps.instructor_grade_archive` stays
  the original fetch time, and the refresh report states which fetch dates the
  grades come from. A subject that has never been fetched is a `failed` cell;
  a clone with no prior run at all aborts with an instruction to run `live`.
- **`live`.** Fetches the archive behind the operator's session cookie,
  attached to requests for the archive host only. A redirect to Single Sign-On
  fails the run with `Instructor Grade Archive redirected <subject> to UCSD
Single Sign-On` instead of parsing the login page.

Refresh the grades (roughly once per quarter, after grades post) with:

```bash
bun tools/etl/capture-grade-archive-session.mts   # opens Chrome; you sign in
bun run etl:refresh:grades                         # live mode, same PR flow
```

The capture script opens a fresh Chrome window on the archive page; Single
Sign-On and two-step login are done by the operator, never by tooling. Once
the archive form loads it writes the browser's cookies for `qa-as.ucsd.edu`
as one `Cookie` header line to `~/.coursetable-etl/grade-archive-session`
(mode 600, outside the repository), proves the file with one archive query,
and closes the window. `check-grade-archive-session.mts` re-proves an existing
file. After a live refresh, commit and open the PR as for any manual run of
`etl:refresh`; the next scheduled `reuse` runs carry the new grades forward.

## Post-Merge Protected Rollout (2026-08-10, ADR 0043)

This section supersedes the earlier statement that deployment dispatch remains
manual. Review and merge of the Monday/Thursday `data-refresh/*` PR remain
manual. After merge, `.github/workflows/scheduled-data-refresh-rollout.yml`
waits for the resulting `main` CI run to succeed, proves that the commit came
from a merged scheduled-refresh PR, and then enters the existing protected
Staging-to-Production sequence.

The Staging and Production GitHub Environments keep their required-reviewer
gates. Staging must be approved, deployed, smoked, and accepted before the same
commit can queue for Production approval. Production deploys with public login
disabled; the separate login-toggle approval path is unchanged. Failed CI,
non-refresh commits, failed Staging, and unapproved environments do not advance.

Implementation correction, 2026-08-10: both reusable deployment calls include
`secrets: inherit`. This is required for the called workflow's secret context;
the Staging and Production Environment approvals remain the access gates.

## Bounded Local Data Retention (2026-08-19, ADR 0044)

This section supersedes the earlier ADR 0042 wording that described every raw
and normalized run as permanently accumulating in the shared local archive.
The `data/` symlink remains shared between the scheduled worktree and main
clone, but a fully successful refresh now applies `config/etl-retention.json`.

The retention closure keeps whole dated run directories reached by the Import
Manifests from both sides of the refresh:

- the accepted pre-refresh baseline;
- the newly generated candidate; and
- any explicitly pinned parser-replay or audit run with a non-empty reason.

Everything else under the recognized dated `data/raw/multi-*`,
`data/raw/classplanner/<TERM>/<timestamp>`, and `data/normalized/multi-*`
boundaries is removed. Unknown/manual directories are never inferred to be
disposable. A successful pass also removes superseded runs' import reports,
rebuildable `catalog_snapshot.staging.json` files, and every completed ETL
report's `before/` copy while keeping `refresh-report.json` and
`refresh-report.md`.

Retention runs only after source acquisition, publication, validators, and
report generation all succeed. A failed refresh leaves its raw and normalized
evidence untouched for diagnosis. The next successful run removes that evidence
only when neither a manifest nor a pin still reaches it.

Add a pin before relying on a dated run for future parser work:

```json
{
  "version": 1,
  "pinned_directories": [
    {
      "directory": "data/raw/multi-<timestamp>-<id>-<term>",
      "reason": "Parser replay case and the behavior it proves"
    }
  ]
}
```

Pins may name only a managed dated raw, Class Planner, or normalized run. A
missing pinned directory is reported because a fresh machine may keep that
evidence only in cold storage; a broad or malformed pin fails closed before any
retention deletion.
