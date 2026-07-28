#!/bin/sh
set -e

# Apply the schema to the database before the app starts.
# `db push` is idempotent: it creates/updates tables to match prisma/schema.prisma.
echo "→ Syncing database schema…"
node node_modules/prisma/build/index.js db push --skip-generate || {
  echo "prisma db push failed — is DATABASE_URL reachable?" >&2
  exit 1
}

echo "→ Starting PlacidCRM on port ${PORT:-3000}…"
# On first run the database is empty — open /register to create the owner
# account, then add each business (sub-account) from the dashboard.
exec "$@"
