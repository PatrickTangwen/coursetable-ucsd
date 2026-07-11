# Hosted-like authentication validation (2026-07-10)

This note records the disposable acceptance path added for issue #82. It
supplements the older Beta-1 validation notes; it does not replace their
historical development-mode procedure.

## Boundary being tested

The local validation overlay starts the App Backend with `NODE_ENV=production`,
Postgres App DB persistence, and Redis-backed sessions. It selects the explicit
`capture` verification-email provider and sets `HOSTED_AUTH_VALIDATION=true`.
The capture provider is rejected unless that validation guard is enabled, and
production otherwise defaults to the Resend provider.

The capture sender writes one mode-`0600` file inside the disposable API
container. The validator reads the code internally, deletes the file, and uses
the code for the API verification request. The request-verification HTTP
response must not contain `devCode`, and the run fails if the capture is absent.
No email is sent and no Resend API key is needed.

## Run

Use an isolated Compose project and non-conflicting local ports when another
development stack is active. The API's production cookie expects HTTPS at its
trusted reverse-proxy boundary. For direct disposable-container validation,
set `TRUSTED_PROXY_CIDRS` to the exact local Docker network CIDR and the
validator supplies `X-Forwarded-Proto: https`.

```sh
COURSETABLE_AUTH_PROJECT=coursetable-auth-validation \
  TRUSTED_PROXY_CIDRS=<local-docker-network-cidr> \
  api/compose/hosted-validation-up.sh

COURSETABLE_AUTH_PROJECT=coursetable-auth-validation \
  bun run validate:real-backend-auth --api-origin http://localhost:3000

COURSETABLE_AUTH_PROJECT=coursetable-auth-validation \
  api/compose/hosted-validation-down.sh --volumes
```

The acceptance covers request-verification, the required sender call, code
verification, App User ID ownership, isolation from a second App User,
current-user session restoration, Redis session presence/removal, and logout.

Evidence artifacts intentionally contain only HTTP status values, booleans,
counts, and one-way fingerprints. They omit verification codes, cookies, API
keys, raw App User IDs, full Redis keys, and database rows.
