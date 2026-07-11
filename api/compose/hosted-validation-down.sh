#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ENV_FILE=${COURSETABLE_AUTH_ENV_FILE:-"$SCRIPT_DIR/local-validation.env.example"}
PROJECT_NAME=${COURSETABLE_AUTH_PROJECT:-coursetable-auth-validation}

cd "$SCRIPT_DIR"

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f dev-compose.yml \
  -f local-validation-compose.yml \
  -f hosted-validation-compose.yml \
  -p "$PROJECT_NAME" \
  down --remove-orphans "$@"
