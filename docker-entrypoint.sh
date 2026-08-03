#!/bin/sh
set -e

PRISMA="node node_modules/prisma/build/index.js"
LOG=/tmp/migrate.log

# Apply the schema to the database before the app starts.
#
# We use `migrate deploy`, NOT `db push`. `db push` reshapes the live database
# to match whatever schema file is in this image — so an image built from a
# branch that was missing a column would silently DROP that column and its
# data in production. That nearly happened to Site.theme. `migrate deploy` only
# ever runs the reviewed .sql files in prisma/migrations, so a schema change
# has to be written down and committed before it can touch production data.
echo "→ Applying database migrations…"
if $PRISMA migrate deploy > "$LOG" 2>&1; then
  cat "$LOG"
else
  cat "$LOG"
  # P3005: the database already has tables but no migration history. That is
  # the pre-existing production database on first switch-over — adopt it as
  # already being at 0_init rather than trying to recreate 60 tables over it.
  if grep -q "P3005" "$LOG"; then
    echo "→ Existing database with no migration history — baselining as 0_init…"
    $PRISMA migrate resolve --applied 0_init
    $PRISMA migrate deploy
  else
    echo "prisma migrate deploy failed — see the error above." >&2
    exit 1
  fi
fi

echo "→ Starting PlacidCRM on port ${PORT:-3000}…"
# On first run the database is empty — open /register to create the owner
# account, then add each business (sub-account) from the dashboard.
exec "$@"
