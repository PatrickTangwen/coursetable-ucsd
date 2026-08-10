# Roll Out Merged Scheduled Refreshes Through Protected Environments

Status: accepted. Supersedes ADR 0042 only for post-merge deployment dispatch.

## Decision

Keep the Monday/Thursday Scheduled Refresh review PR and human merge decision.
After a `data-refresh/*` PR is merged into `main` and the resulting `main` CI
run succeeds, automatically enter the existing protected deployment sequence:

1. run the complete Staging preflight and request approval for the `Staging`
   Environment;
2. deploy, smoke, and record durable Staging acceptance after that approval;
3. only after Staging succeeds, run the complete Production preflight and
   request approval for the `Production` Environment;
4. deploy Production with public login forced off after Production approval.

The chain reuses the existing deployment workflows. It passes the exact green
`main` commit from Staging into Production, so Production does not depend on a
maintainer racing to update `STAGING_ACCEPTED_COMMIT`. Manual dispatch remains
available and continues to use the durable environment variable when no commit
is supplied by the protected chain.

## Why

ADR 0042 removed the work of running and opening refresh PRs but left every
post-merge workflow dispatch manual. That duplicated deterministic routing and
made a reviewed data refresh easy to leave undeployed. Environment reviewers,
smoke tests, durable accepted evidence, and automatic rollback already own the
important release judgment and safety boundaries.

## Consequences

- Data review and merge are still human decisions; this does not auto-merge a
  refresh PR.
- Failed PR CI or failed `main` CI cannot enter Staging.
- Non-refresh commits cannot enter this automatic chain.
- Staging and Production Environment protections remain authoritative. The
  workflow queues at each required-reviewer gate and cannot access that
  environment's secrets before approval.
- Production public login remains disabled. The separate audited login-toggle
  workflow is not part of this chain.
- Recovery flags remain off; a stranded unaccepted first deployment still
  requires separate explicit authorization.

## Implementation Correction (2026-08-10)

Reusable workflow calls must declare `secrets: inherit`. Without that caller
contract, GitHub resolves the called deployment workflow's secret references to
empty values even after the called job passes its Environment approval gate.
Both the Staging and Production calls declare inheritance; their respective
Environment protections still control when each called job can access its own
secrets.

## Single-Approval Automation Correction (2026-08-10)

The accepted Monday/Thursday operating contract now treats the repository
owner's merge of a generated `data-refresh/*` PR as the only human release
gate. The automatic chain additionally rejects refresh PRs that contain files
outside the generated catalog artifact allowlist, then requires green `main`
CI, Staging smoke and durable acceptance before Production can start.

The `Staging` and `Production` GitHub Environments retain their branch policies
and environment-scoped credentials, but no longer require separate reviewer
clicks for this chain. This setting also means a manually dispatched deployment
does not pause for an Environment reviewer; its exact-main-SHA, Staging
acceptance, recovery, smoke, rollback, and evidence checks remain in force.

The reusable Production workflow still defaults to public login disabled for
manual dispatch. Only the qualified scheduled-refresh caller passes the
login-enabled input, so routine catalog publication preserves the live site's
login state without requiring a second login-toggle approval.
