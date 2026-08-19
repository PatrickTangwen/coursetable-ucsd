# Bound Local ETL History By Manifest Reachability

Status: accepted. Supersedes ADR 0042 only where it describes all local raw
and normalized runs as a permanently accumulating durable archive.

## Decision

After a fully successful ETL refresh has published candidate artifacts, passed
the credential-free validators, and written its refresh report, prune dated
local raw and normalized runs that are not reachable from either:

- the Import Manifests that existed before the refresh;
- the candidate Import Manifests written by the refresh; or
- an explicit replay/audit pin in `config/etl-retention.json` with a reason.

Reachability is evaluated at the run-directory boundary. If any manifest
artifact is inside a run, the whole run stays available. The cleanup recognizes
only `multi-<timestamp>-...` directories and dated Class Planner run
directories; unknown or manually named directories are outside its deletion
authority.

The same successful cleanup removes superseded runs' local import reports,
retained runs' rebuildable `catalog_snapshot.staging.json` files, and every
completed refresh report's `before/` copy. Published Snapshots, Frozen
Snapshots, Import Manifests, refresh report JSON/Markdown, and the Term Archive
are not retention targets.

If acquisition, parsing, publication, validation, report generation, manifest
reading, or policy validation fails, retention does not run. A failed run's
evidence therefore remains available until a later successful run determines
that no manifest or explicit pin reaches it.

## Why

The previous local layout accumulated a complete multi-term fetch on every
scheduled refresh even when an older date no longer contributed to a
Published/Frozen Snapshot, parser replay, or audit. That growth was unrelated
to the forward-accumulating Term Archive: the durable product artifacts are the
Published/Frozen Snapshots and Import Manifests, while dated raw/normalized
inputs are operational provenance.

Keeping both the pre-refresh and candidate manifest closures preserves the
accepted baseline during review and the new candidate's provenance. Explicit
pins make exceptional parser-repair fixtures deliberate and reviewable instead
of retaining every run as an implicit fallback.

## Consequences

- Local ETL history is bounded by actual provenance reachability, not an age or
  fixed-count heuristic.
- Parser fixes that need a particular dated run must add a reasoned pin before
  that run becomes unreachable. Missing pins are reported but do not break a
  fresh machine where the pinned evidence exists only in cold storage.
- A superseded unmerged candidate may lose its local inputs after a newer
  successful refresh; its published JSON and Import Manifest remain reviewable.
- Normalized metadata consolidation still scans every retained run before the
  cleanup. Any selected metadata artifact is written into the candidate
  manifest and therefore remains reachable for the next refresh.
- Full local-history packages such as the 2026-08-15 CourseHub archive are cold
  archives, not part of recurring ETL retention.
- Detailed operation and verification notes live in `docs/etl_refresh.md`.
