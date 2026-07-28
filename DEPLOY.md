# Deploying PlacidCRM to your DigitalOcean server

This guide takes you from a fresh DigitalOcean droplet to PlacidCRM running on
**PlacidCRM.com**. Everything runs in Docker: the Next.js app, PostgreSQL, and
an nginx reverse proxy that terminates TLS.

You do **not** need to put any server passwords or keys into this repository.

---

## What you'll need

- A DigitalOcean droplet (Ubuntu 22.04/24.04, **2 GB RAM minimum**, 2 GB is comfortable).
- Your domain **PlacidCRM.com** at GoDaddy (you already have this).
- SSH access to the droplet.

---

## Step 1 — Create the droplet

1. In DigitalOcean: **Create → Droplet**.
2. Choose **Ubuntu 24.04 LTS**, a Basic plan with **2 GB RAM / 1 CPU** (or larger).
3. Pick a region close to you (e.g. **Sydney (SYD1)** for Australia).
4. Add your SSH key, create the droplet, and note its **public IP** (e.g. `203.0.113.10`).

## Step 2 — Point GoDaddy DNS at the droplet

In GoDaddy → **My Products → PlacidCRM.com → DNS**, create these records
(replace `203.0.113.10` with your droplet IP):

| Type  | Name  | Value          | TTL  |
|-------|-------|----------------|------|
| A     | `@`   | `203.0.113.10` | 600  |
| A     | `www` | `203.0.113.10` | 600  |
| A     | `*`   | `203.0.113.10` | 600  |

The wildcard `*` record means every future sub-account can get its own
subdomain (e.g. `storage.placidcrm.com`, `homestead.placidcrm.com`) with no
extra DNS work. DNS can take 10–60 minutes to propagate.

## Step 3 — Install Docker on the droplet

SSH in (`ssh root@203.0.113.10`) and run:

```bash
curl -fsSL https://get.docker.com | sh
docker --version
```

## Step 4 — Get the code onto the server

```bash
# On the droplet:
git clone https://github.com/simonjohnston123/simonjohnston123.git placidcrm
cd placidcrm
# Use the branch this platform was built on:
git checkout claude/placidcrm-saas-platform-trd4lf
```

## Step 5 — Configure environment

```bash
cp .env.example .env
nano .env
```

Set these values:

```dotenv
POSTGRES_USER=placid
POSTGRES_PASSWORD=<a long random password>
POSTGRES_DB=placidcrm

# MUST be a long random string — generate with: openssl rand -base64 48
AUTH_SECRET=<paste generated secret>

APP_URL=https://placidcrm.com
ROOT_DOMAIN=placidcrm.com
```

> `docker-compose.yml` builds `DATABASE_URL` for the app automatically from the
> `POSTGRES_*` values, so you don't set it by hand for the Docker deploy.

## Step 6 — TLS certificate

The nginx container expects `nginx/certs/fullchain.pem` and
`nginx/certs/privkey.pem`. The easiest way to get a wildcard cert (so tenant
subdomains work) is Let's Encrypt via DNS challenge:

```bash
# On the droplet
apt-get update && apt-get install -y certbot
certbot certonly --manual --preferred-challenges dns \
  -d placidcrm.com -d '*.placidcrm.com'
# Follow the prompt: add the TXT record it gives you in GoDaddy DNS, wait, continue.

# Copy the issued cert into the repo's nginx/certs directory:
cp /etc/letsencrypt/live/placidcrm.com/fullchain.pem nginx/certs/fullchain.pem
cp /etc/letsencrypt/live/placidcrm.com/privkey.pem  nginx/certs/privkey.pem
```

(If you'd rather skip TLS while testing, comment out the `nginx` service in
`docker-compose.yml` and browse to `http://<droplet-ip>:3000`.)

## Step 7 — Build and start

```bash
docker compose up -d --build
docker compose logs -f app     # watch it boot; Ctrl-C to stop watching
```

The app's entrypoint runs `prisma db push` automatically, so the database
tables are created on first boot. Check health:

```bash
curl -s http://localhost:3000/api/health
# {"status":"ok","db":"up",...}
```

## Step 8 — Create your owner account

Open **https://placidcrm.com/register** in a browser. Because the database is
empty, this first registration becomes the **platform owner** (super admin).
After that, public registration closes automatically.

Then from the dashboard:
- Click **+ Add business** to create **Placid Storage Solutions**.
- Click **+ Add business** again to create **Placid Homestead**.

Each business is provisioned with its own contacts, sales pipeline, calendar and
website. Open the **Website** tab, edit the pages, tick **Published**, and the
site goes live at `https://placidcrm.com/sites/<slug>`.

### Optional: load sample data instead

If you'd rather start with the two Placid businesses pre-created (with a sample
lead and website already published), run the seed once instead of registering:

```bash
docker compose exec app node_modules/.bin/prisma db seed
# Sign in at /login with the email/password printed by the seed
# (default simonjohnston123@gmail.com / ChangeMe123! — change it immediately).
```

---

## Updating later

```bash
cd placidcrm
git pull
docker compose up -d --build
```

## Pointing a tenant's own domain at a business

When a business wants its site on its own domain (e.g. `placidhomestead.com.au`):

1. In that domain's DNS, add an `A` record to your droplet IP (or a `CNAME` to
   `placidcrm.com`).
2. In PlacidCRM → the business → **Website**, set **Custom domain** to that host.
3. Re-issue the TLS cert to include the new domain, or use a load balancer /
   Caddy for automatic certs (see the roadmap in `README.md`).

## Backups

Your data lives in the `pgdata` Docker volume. Back it up regularly:

```bash
docker compose exec db pg_dump -U placid placidcrm > backup-$(date +%F).sql
```

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `AUTH_SECRET is not set` on boot | Set `AUTH_SECRET` in `.env`, then `docker compose up -d`. |
| `/api/health` shows `db: down` | Check `docker compose logs db`; ensure the `db` container is healthy. |
| 502 from nginx | The app container is still starting or crashed — `docker compose logs app`. |
| TLS errors | Confirm `nginx/certs/fullchain.pem` and `privkey.pem` exist and match your domain. |
