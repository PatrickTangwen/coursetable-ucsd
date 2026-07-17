# Agent Instructions

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `PatrickTangwen/coursetable-ucsd`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

### Documentation, planning, and context docs

Use `docs/README.md` as the first navigation point for stable project
documentation. Use `docs/planning/README.md` only for archived planning context.
Current executable planning lives in GitHub Issues.

The stable docs structure is:

- `docs/README.md` for top-level stable documentation navigation.
- `docs/local_server.md` for opening or restarting the local frontend,
  backend/auth stack, and login flow.
- `docs/snapshot_pipe.md` for catalog snapshot pipeline notes, including General
  Catalog enrichment, Schedule parser edge cases, and raw HTML replay rules.

The planning and context structure is:

- `CONTEXT.md` for shared domain vocabulary and stable product terms.
- `docs/adr/README.md` and `docs/adr/*.md` for durable decisions.
- GitHub Issues for current executable implementation slices.
- `docs/planning/README.md` for the planning archive index.
- `docs/planning/archive/` for historical planning inputs and completed PRDs.

Do not use `starter_plan_and_data/` as a current doc root; those files were
moved under `docs/planning/`.
