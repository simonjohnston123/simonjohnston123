# PlacidCRM — Disaster Recovery

Last verified by live restore test: **2026-08-03** (6 businesses, 333 contacts,
60,001 products, 54 conversations, 3 users restored clean).

## What exists

| Asset | Lives on | Protected by |
|---|---|---|
| Application code | GitHub `simonjohnston123/simonjohnston123` | Git remote |
| Database (166 MB) | prod droplet `134.199.156.144` | Nightly bundle → off-site |
| Uploads (media) | Docker volume `placidcrm_uploads` | Nightly bundle → off-site |
| Secrets (`.env`, 36 keys) | prod droplet only | Nightly bundle → off-site |
| Infra config (compose, Caddyfile, crontab) | prod droplet | Nightly bundle → off-site |

## The backup

`/opt/backups/backup.sh` on the prod droplet, cron **03:17 daily**, log at
`/var/log/placid-backup.log`.

Produces `placidcrm-dr-YYYYMMDD-HHMM.tar.gz` (~22 MB) containing `db.sql.gz`,
`uploads.tar.gz`, `env`, `docker-compose.prod.yml`, `Caddyfile`, `crontab.txt`.

It **refuses to keep a bad backup**: the dump must pass `gzip -t` and contain at
least 10 `CREATE TABLE` statements, and the finished bundle is re-verified. If
the off-site copy fails it exits non-zero and says so loudly, because a backup
that only exists on the server it is backing up is not a backup.

Retention: 14 copies on the prod droplet, 14 off-site
(`/opt/placidcrm-offsite-prune.sh`, cron 04:42 on the Connect droplet).

### Off-site target

Replicated by sftp to the Placid Connect droplet `209.38.21.226`
(`/opt/placidcrm-offsite`) using `/root/.ssh/backup_replica`. That key is
installed on the Connect droplet with `command="internal-sftp",restrict`, so if
the prod droplet is ever compromised the key cannot be used to run commands —
only to write backups.

> The off-site bundle contains `env` in plaintext. Treat `209.38.21.226` as
> holding production secrets.

## Restore: server totally lost

1. Create a new Ubuntu droplet (2 GB+), install Docker + compose.
2. Pull the newest bundle from the off-site host:
   ```
   scp root@209.38.21.226:/opt/placidcrm-offsite/placidcrm-dr-*.tar.gz .
   tar xzf placidcrm-dr-*.tar.gz
   ```
3. Clone the code, drop the recovered config in place:
   ```
   git clone https://github.com/simonjohnston123/simonjohnston123.git /opt/placidcrm
   cp env /opt/placidcrm/.env
   cp docker-compose.prod.yml Caddyfile /opt/placidcrm/
   ```
4. Start the database only, then load it:
   ```
   cd /opt/placidcrm && docker compose -f docker-compose.prod.yml up -d db
   gzip -dc db.sql.gz | docker exec -i placidcrm-db-1 psql -U <POSTGRES_USER> -d <POSTGRES_DB>
   ```
   `ERROR: ... does not exist` lines are normal — the dump drops before creating.
5. Restore media:
   ```
   docker run --rm -v placidcrm_uploads:/u -v $PWD:/in alpine tar xzf /in/uploads.tar.gz -C /u
   ```
6. Bring the app up, repoint DNS `placidcrm.com` → new IP, let Caddy issue TLS:
   ```
   docker compose -f docker-compose.prod.yml build app
   docker compose -f docker-compose.prod.yml up -d
   ```
7. Reinstall the backup cron (`crontab.txt` in the bundle) and regenerate the
   off-site key — the old one died with the old server.

**Realistic RTO ~45–60 min. RPO up to 24 h** (worst case: a crash at 03:16 loses
one day). Shorten RPO by running the script more often — it is safe to re-run.

## Verify it still works

Restore-test quarterly into a throwaway container (never against prod):

```
docker run -d --name rtest-db -e POSTGRES_PASSWORD=t -e POSTGRES_DB=rtest postgres:16-alpine
gzip -dc db.sql.gz | docker exec -i rtest-db psql -q -U postgres -d rtest
docker exec rtest-db psql -U postgres -d rtest -c 'select count(*) from "Contact";'
docker rm -f rtest-db
```

## Known gaps

- **No whole-machine image.** DigitalOcean automated backups (~20% of droplet
  cost) would allow a one-click rebuild instead of the manual steps above.
  Not enabled — requires account access.
- **Both droplets are in the same DigitalOcean account.** Protects against
  server loss, not account loss. A monthly bundle pulled to local disk or
  another provider would close that.
## Schema changes

Production applies schema with `prisma migrate deploy` (see
`docker-entrypoint.sh`), **not** `db push`. Only committed `.sql` files in
`prisma/migrations` can alter production data, so an image built from a stale
branch can no longer silently drop a column. The existing database was
baselined as `0_init` on 2026-08-03.

To change the schema: edit `prisma/schema.prisma`, run `npx prisma migrate dev
--name <what-changed>` locally, review the generated SQL, commit it, deploy.
