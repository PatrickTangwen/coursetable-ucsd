#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
RUN_ID=$$
NETWORK="sungrid-backup-test-${RUN_ID}"
SOURCE_CONTAINER="sungrid-backup-source-${RUN_ID}"
RESTORE_CONTAINER="sungrid-backup-restore-${RUN_ID}"
OBJECT_STORE=$(mktemp -d)

cleanup() {
  docker rm -f "$SOURCE_CONTAINER" "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$OBJECT_STORE"
}

trap cleanup EXIT INT TERM

docker network create "$NETWORK" >/dev/null
for container in "$SOURCE_CONTAINER" "$RESTORE_CONTAINER"; do
  docker run --rm -d \
    --name "$container" \
    --network "$NETWORK" \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=app \
    -p 127.0.0.1::5432 \
    postgres:18 >/dev/null
done

for container in "$SOURCE_CONTAINER" "$RESTORE_CONTAINER"; do
  until docker exec "$container" pg_isready -U postgres -d app >/dev/null 2>&1; do
    sleep 1
  done
done

SOURCE_PORT=$(docker port "$SOURCE_CONTAINER" 5432/tcp | sed 's/.*://')
RESTORE_PORT=$(docker port "$RESTORE_CONTAINER" 5432/tcp | sed 's/.*://')
SOURCE_HOST_URL="postgresql://postgres:test@127.0.0.1:${SOURCE_PORT}/app"
RESTORE_HOST_URL="postgresql://postgres:test@127.0.0.1:${RESTORE_PORT}/app"

cd "$SCRIPT_DIR/.."
DB_URL="$SOURCE_HOST_URL" bun run db:migrate >/dev/null
docker exec "$SOURCE_CONTAINER" psql -U postgres -d app -v ON_ERROR_STOP=1 \
  -c "insert into \"appUsers\" (\"verifiedEmail\", \"createdAt\", \"updatedAt\") values ('dump-private@ucsd.edu', 1, 1)" \
  >/dev/null

APP_DB_BACKUP_SOURCE_URL="$SOURCE_HOST_URL" \
APP_DB_BACKUP_PG_SOURCE_URL="postgresql://postgres:test@${SOURCE_CONTAINER}:5432/app" \
APP_DB_RESTORE_TEST_URL="$RESTORE_HOST_URL" \
APP_DB_RESTORE_PG_URL="postgresql://postgres:test@${RESTORE_CONTAINER}:5432/app" \
APP_DB_BACKUP_LOCAL_DIRECTORY="$OBJECT_STORE" \
APP_DB_POSTGRES_TOOLS_IMAGE=postgres:18 \
APP_DB_POSTGRES_DOCKER_NETWORK="$NETWORK" \
  bun run app-db:recovery:test

APP_DB_RESTORE_TEST_URL="$RESTORE_HOST_URL" \
  bunx vitest run src/appDatabaseBackup/restoreVerifier.test.ts
