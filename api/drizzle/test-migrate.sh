#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
CONTAINER_NAME="coursetable-migration-test-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

docker run --rm -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=app \
  -p 127.0.0.1::5432 \
  postgres:13 >/dev/null

until docker exec "$CONTAINER_NAME" pg_isready -U postgres -d app >/dev/null 2>&1; do
  sleep 1
done

PORT=$(docker port "$CONTAINER_NAME" 5432/tcp | sed 's/.*://')
cd "$SCRIPT_DIR/.."
APP_DB_MIGRATION_TEST_URL="postgresql://postgres:test@127.0.0.1:${PORT}/app" \
  bun run test:db:migrate
