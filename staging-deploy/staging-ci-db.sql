-- Staging-database-only credentials for CI.
--
-- Run as a Postgres superuser INSIDE the placidcrm-db-1 container:
--   docker exec -i placidcrm-db-1 psql -U postgres -f - < staging-ci-db.sql
--
-- SCOPE NOTE, because it decides whether you need this at all:
-- the DEPLOY path does NOT need a database credential. Migrations run as
-- `prisma migrate deploy` INSIDE the staging container, using that
-- container's own DATABASE_URL. This role exists for the TEST leg — running
-- the vitest suite in CI against staging, which docs/TESTING.md currently
-- does by hand through an SSH tunnel. Skip this file if you are only
-- installing the deploy workflow.
--
-- Both databases share one Postgres instance. The isolation below is
-- enforced twice: by privilege here, and by pg_hba.conf (see README) which
-- refuses this role a connection to `placidcrm` before privileges are even
-- consulted.

\set ON_ERROR_STOP on

-- 1. The role. Replace the password before running; do not reuse the app's.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'placid_staging_ci') THEN
    CREATE ROLE placid_staging_ci LOGIN PASSWORD 'CHANGE_ME_BEFORE_RUNNING';
  END IF;
END
$$;

-- No inherited superpowers, ever.
ALTER ROLE placid_staging_ci NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- 2. Staging only.
GRANT CONNECT ON DATABASE placidcrm_staging TO placid_staging_ci;

-- 3. Explicitly refuse production. This is belt-and-braces: pg_hba should
--    already reject the connection. It is written as a REVOKE of the role's
--    own grant, NOT as `REVOKE ... FROM PUBLIC`, because revoking from
--    PUBLIC on the production database would also strip every other role
--    that relies on the default and can take the app down.
REVOKE ALL ON DATABASE placidcrm FROM placid_staging_ci;

\connect placidcrm_staging

-- 4. The suite creates and deletes an agency, so it needs DML and DDL on the
--    public schema of staging — but nothing beyond that database.
GRANT USAGE, CREATE ON SCHEMA public TO placid_staging_ci;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO placid_staging_ci;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO placid_staging_ci;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO placid_staging_ci;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO placid_staging_ci;

-- 5. Prove the fence, both directions. A check that only tests the allowed
--    case cannot tell "restricted" from "not wired up".
\echo ''
\echo 'Verify manually — the first MUST succeed, the second MUST be refused:'
\echo '  psql "postgresql://placid_staging_ci:PW@127.0.0.1:5432/placidcrm_staging" -c "select 1"'
\echo '  psql "postgresql://placid_staging_ci:PW@127.0.0.1:5432/placidcrm"         -c "select 1"'
\echo ''
