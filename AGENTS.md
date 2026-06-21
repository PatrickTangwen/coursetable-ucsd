# Agent Instructions

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `PatrickTangwen/coursetable-ucsd`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.

### Planning and context docs

Use `docs/planning-index.md` as the first navigation point for current planning
and context docs. The optimized doc structure is:

- `CONTEXT.md` for shared domain vocabulary and stable product terms.
- `docs/adr/README.md` and `docs/adr/*.md` for durable decisions.
- `docs/planning/README.md` for the current-vs-historical planning boundary.
- `docs/planning/post-mvp-roadmap.md` for current roadmap sequence and scope.
- `docs/planning/archive/` for historical planning inputs.
- `docs/planning/source-data/` for source planning/data sheets.

Do not use `starter_plan_and_data/` as a current doc root; those files were
moved under `docs/planning/`.
