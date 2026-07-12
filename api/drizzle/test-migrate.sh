#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
CONTAINER_NAME="coursetable-migration-test-$$"
REPO_ROOT=$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)
PREVIOUS_WORKER_REF=51d655dc6b0915a6f9bed7dfa1e76db0f9dc97a2
PREVIOUS_WORKTREE=

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  if [ -n "$PREVIOUS_WORKTREE" ]; then
    git -C "$REPO_ROOT" worktree remove --force "$PREVIOUS_WORKTREE" \
      >/dev/null 2>&1 || true
    rm -rf "$PREVIOUS_WORKTREE"
  fi
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

cd "$SCRIPT_DIR/../.."
APP_DB_WORKER_COMPATIBILITY_TEST_URL="postgresql://postgres:test@127.0.0.1:${PORT}/app" \
  bunx vitest run worker/src/appDatabaseExternalContract.test.ts

PREVIOUS_WORKTREE=$(mktemp -d)
rmdir "$PREVIOUS_WORKTREE"
git worktree add --detach "$PREVIOUS_WORKTREE" "$PREVIOUS_WORKER_REF" \
  >/dev/null
cp worker/src/appDatabaseExternalContract.test.ts \
  "$PREVIOUS_WORKTREE/worker/src/appDatabaseExternalContract.test.ts"
ln -s "$REPO_ROOT/node_modules" "$PREVIOUS_WORKTREE/node_modules"
cd "$PREVIOUS_WORKTREE"
APP_DB_WORKER_COMPATIBILITY_TEST_URL="postgresql://postgres:test@127.0.0.1:${PORT}/app" \
  "$REPO_ROOT/node_modules/.bin/vitest" run \
  worker/src/appDatabaseExternalContract.test.ts
