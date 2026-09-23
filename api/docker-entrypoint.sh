#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

masked_url=$(printf '%s' "$DATABASE_URL" | sed -E 's|://([^:/@]+):[^@]*@|://\1:***@|')
echo "Using DATABASE_URL: $masked_url"

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "RUN_SEED=true — seeding base content (categories, pages, settings)..."
  node prisma/seed-content.cjs
fi

echo "Starting RENDI VIRGO API on port ${PORT:-4000}..."
exec node dist/main.js
