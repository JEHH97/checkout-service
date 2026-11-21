#!/bin/sh
set -eu

case "${RUN_DB_PUSH:-true}" in
  true) ./node_modules/.bin/prisma db push ;;
  false) ;;
  *) echo "RUN_DB_PUSH must be true or false" >&2; exit 1 ;;
esac

case "${RUN_SEED:-false}" in
  true) npm run seed ;;
  false) ;;
  *) echo "RUN_SEED must be true or false" >&2; exit 1 ;;
esac

exec node dist/main.js
