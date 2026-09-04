# Instructor Grade Archive As An On-Demand Source

Status: accepted. Amends ADR 0042 (scheduled refresh) where it assumes every
source is anonymously reachable on the schedule.

## Decision

The scheduled refresh no longer fetches the Instructor Grade Archive. In its
default `reuse` mode, `run-refresh.mts` serves each Configured Subject from the
newest prior normalized run that holds an archive artifact for it. The Import
Manifest cell points at that prior artifact, so manifest reachability
(ADR 0044) keeps the run, and the published `source_timestamps` keep the
original fetch time. The refresh report states the fetch dates the grades come
from.

Grades are refreshed on demand in `live` mode: the operator signs in to UCSD
Single Sign-On in a browser window opened by `capture-grade-archive-session`,
the resulting `Cookie` header is stored outside the repository, and the
fetcher attaches it to requests for the archive host only. Archive requests do
not follow redirects; a redirect to Single Sign-On fails the run explicitly.
Tooling never handles the operator's password or second factor.

## Why

On 2026-09-03 both scheduled runs failed because the archive started
redirecting anonymous requests to Single Sign-On; every subject page came back
as the login form and the systemic-parser gate correctly aborted the refresh.
The signed-in page and table are unchanged, but the Shibboleth session behind
the cookie expires about two hours after authentication, so a captured
session cannot survive to the next Monday or Thursday run. Grade archive rows
change once a quarter, while Schedule of Classes changes daily; tying the
daily source's schedule to a credential the operator must renew by hand would
either stall the schedule or turn it into a manual job.

Alternatives considered:

- **Session cookie only.** Implemented as the `live` mode, but rejected as the
  scheduled path because of the two-hour session lifetime.
- **Silently carry the last archive forward when a live fetch fails.**
  Rejected: a failed fetch and an intentional reuse would look the same in
  the report. Reuse is an explicit mode that makes no request; a failed live
  fetch still fails the run.
- **Drive the login flow from the ETL.** Rejected: it would require storing
  the operator's password and second factor in automation.
- **Keep the IdP session alive or replay it headlessly.** Not pursued; its
  lifetime is outside the project's control and the approach would amount to
  circumventing the login wall.

## Consequences

- Scheduled PRs keep publishing fresh schedules with grades whose fetch date
  is stated in the report; grade freshness is now an operator decision made
  by running `etl:refresh:grades` after signing in.
- A subject that has never been fetched is a `failed` archive cell in reuse
  mode; a clone without any prior normalized run cannot run in reuse mode
  until one live refresh has happened.
- The session file lives outside the repository and is not part of the
  worktree reset or any deployment artifact.
- If the archive returns to anonymous access, `live` mode without a session
  file is not supported; the fetcher can be made anonymous again by dropping
  the session requirement in a follow-up decision.
