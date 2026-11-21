#!/bin/sh
set -eu

# A writable named volume is mounted at the generated-client path in the
# production compose file. Refresh it from this image on every container start.
mkdir -p /app/node_modules/.prisma
cp -a /opt/prisma-client/. /app/node_modules/.prisma/

case "${RUN_DB_PUSH:-true}" in
  true) ./node_modules/.bin/prisma db push ;;
  false) ;;
  *) echo "RUN_DB_PUSH must be true or false" >&2; exit 1 ;;
esac

case "${RUN_SEED:-false}" in
  true) ./node_modules/.bin/tsx prisma/seed.ts ;;
  false) ;;
  *) echo "RUN_SEED must be true or false" >&2; exit 1 ;;
esac

exec node dist/main.js
