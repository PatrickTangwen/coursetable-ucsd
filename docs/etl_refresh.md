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

## Scheduling (Next Slice, Not Yet Wired)

Two options, in preference order:

1. Local launchd/cron on the machine that holds `data/raw` and
   `data/normalized` history, invoking `bun run etl:refresh` and opening a
   review PR.
2. Cloudflare Workers Cron + Workflows with `data/raw` and `data/normalized`
   archived to R2. Blocked on persisting that state off-machine first;
   without it a runner cannot consolidate historical normalized metadata.
