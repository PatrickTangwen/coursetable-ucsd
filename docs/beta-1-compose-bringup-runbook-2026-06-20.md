# Beta-1 Compose Bring-Up Runbook

Status: issue #21 runbook for Doppler-free local backend validation.

This runbook proves the first slice of `Beta-1 Real Backend Auth Validation`:
the inherited CourseTable local Compose stack can start without CourseTable
Doppler access, and the App DB schema can be applied to a disposable local
Postgres database.

## Manual Prerequisite

Install and start Docker Desktop or an equivalent Docker Engine. Do not install
Postgres, Redis, Hasura, pgAdmin, `psql`, or app dependencies on the host for
this validation path; Compose provides those services.

If local ports conflict, copy `api/compose/local-validation.env.example` to an
untracked env file and override the conflicting values. Use it by setting:

```bash
COURSETABLE_AUTH_ENV_FILE=/absolute/path/to/local-validation.env
```

## Doppler-Free Startup

From the repo root:

```bash
api/compose/local-validation-up.sh
api/compose/local-validation-status.sh
```

The wrappers run:

```bash
docker compose --env-file api/compose/local-validation.env.example \
  -f api/compose/docker-compose.yml \
  -f api/compose/dev-compose.yml \
  -f api/compose/local-validation-compose.yml \
  -p coursetable-auth-validation ...
```

Doppler remains an inherited CourseTable path for developers with project
access, but it is not required for this validation path.

## Schema Apply

Apply the App DB schema from inside the API container:

```bash
api/compose/local-validation-schema.sh
```

This runs `bun run db:push` inside the API container against the disposable
local Docker Postgres database. Direct `db:push` is acceptable only for this
disposable local validation database. Shared, staging, or production database
rollout requires a later versioned migration workflow.

## Status Checks

Capture non-sensitive evidence under a gitignored per-run directory:

```bash
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
ARTIFACT_DIR="artifacts/real-backend-auth-validation/$RUN_ID"
mkdir -p "$ARTIFACT_DIR"

api/compose/local-validation-status.sh > "$ARTIFACT_DIR/compose-ps.txt"
curl -ksS https://localhost:3000/api/ping > "$ARTIFACT_DIR/api-ping.txt"
curl -fsS http://localhost:8085/healthz > "$ARTIFACT_DIR/hasura-health.txt"
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' \
  http://localhost:8081/login > "$ARTIFACT_DIR/pgadmin-login.txt"
```

Expected results:

- API, Postgres, Redis, Hasura, and pgAdmin are running.
- Services with health checks report healthy.
- API returns `"pong"` from `/api/ping`.
- Hasura health returns `OK`.
- pgAdmin serves an HTTP login response.

## Cleanup

Stop services without deleting volumes:

```bash
api/compose/local-validation-down.sh
```

Remove the disposable validation volumes when the run no longer needs
inspection:

```bash
api/compose/local-validation-down.sh --volumes
```

The validation override uses Compose-managed volumes instead of
`api/postgres/data`, so cleanup does not default to deleting a developer's
existing local Postgres directory.
