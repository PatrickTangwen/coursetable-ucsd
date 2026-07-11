#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ENV_FILE=${COURSETABLE_CORE_ENV_FILE:-"$SCRIPT_DIR/core-validation.env.example"}
PROJECT_NAME=${COURSETABLE_CORE_PROJECT:-coursetable-core-validation}

cd "$SCRIPT_DIR"
docker compose --env-file "$ENV_FILE" -f core-validation-compose.yml \
  -p "$PROJECT_NAME" up -d --build --wait --remove-orphans "$@"
docker compose --env-file "$ENV_FILE" -f core-validation-compose.yml \
  -p "$PROJECT_NAME" exec -T api bun run db:migrate
