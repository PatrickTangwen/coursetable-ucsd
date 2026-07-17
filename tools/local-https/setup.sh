#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)
CERTIFICATE_DIRECTORY="$REPOSITORY_ROOT/.local-certs"

if ! command -v mkcert >/dev/null 2>&1; then
  echo 'mkcert is required. Install it before setting up local HTTPS.' >&2
  exit 1
fi

mkdir -p "$CERTIFICATE_DIRECTORY"
mkcert -install
mkcert \
  -key-file "$CERTIFICATE_DIRECTORY/localhost-key.pem" \
  -cert-file "$CERTIFICATE_DIRECTORY/localhost-cert.pem" \
  localhost 127.0.0.1 ::1
chmod 600 "$CERTIFICATE_DIRECTORY/localhost-key.pem"

echo "Local HTTPS certificates are ready in $CERTIFICATE_DIRECTORY"
