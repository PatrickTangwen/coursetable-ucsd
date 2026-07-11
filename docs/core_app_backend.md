# Core App Backend

Status: stable architecture and disposable validation reference.

The Core App Backend is the SunGrid application backend for UCSD User
Identity, Redis-backed sessions, Saved Searches, Saved Worksheets, Published
Snapshot files, Supported Term metadata, and health checks. It owns
account-specific App DB behavior and does not depend on Hasura or the Course
Data Store.

## Composition boundary

Core behavior is registered by default. `ENABLED_API_MODULES` is a
comma-separated allowlist for optional integrations; an empty value selects the
Core App Backend only.

Available optional modules are:

- `course-data-platform`: inherited `/ferry` Hasura proxy boundary.
- `legacy-catalog`: inherited GraphQL catalog refresh, evaluations, CSV, and
  sitemap routes.
- `legacy-auth`: inherited Yale CAS route.
- `canny`, `challenge`, `demand`, `friends`, `link-preview`, `profile`, and
  `user`: inherited Yale product modules retained for audit.

The GraphQL-dependent legacy modules require `course-data-platform` to be
enabled in the same allowlist. Enabled modules validate their required
configuration before the server listens. Disabled modules register no routes
and require no placeholder configuration.

The Published Snapshot remains the Catalog source of truth. The public
`/api/catalog/public` and `/api/catalog/metadata` routes are Core routes and do
not activate legacy GraphQL refresh behavior.

## Disposable validation

The isolated acceptance stack contains only the API, App DB Postgres, and
Redis. Its production-mode email sender is the explicit test capture seam; it
does not send email or expose verification codes through HTTP.

```sh
COURSETABLE_CORE_PROJECT=coursetable-core-validation \
  api/compose/core-validation-up.sh

COURSETABLE_AUTH_PROJECT=coursetable-core-validation \
  COURSETABLE_AUTH_ENV_FILE=api/compose/core-validation.env.example \
  TRUSTED_PROXY_CIDRS=<local-docker-private-cidrs> \
  bun run validate:core-backend --api-origin http://localhost:3010
```

The validator checks login, session restore/logout, App User ID ownership for
Saved Searches and Saved Worksheets, Published Snapshot and metadata serving,
health, and absence of disabled legacy routes. It removes captured verification
data and tears down containers and volumes on both success and failure.

Use `api/compose/core-validation-down.sh --volumes` if a setup failure occurs
before the validator starts.
