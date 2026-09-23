#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting RENDI VIRGO API on port ${PORT:-4000}..."
exec node dist/main.js
