#!/bin/sh
set -eu

cd "$(dirname "$0")"
# Use hot reload env var to determine if we should run the server in hot reload mode
if [ "${HOT_RELOAD:-false}" = "true" ]; then
  # Run the server in hot reload mode
  bun run start
else
  # Run the server in production mode
  bun run start:prod
fi
