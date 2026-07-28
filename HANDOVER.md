# PlacidCRM — Project Handover

A ready-to-deploy, multi-tenant CRM SaaS (GoHighLevel-style) for the Placid group
of businesses. This document hands the project from the cloud (web) Claude session
— which built it but has **no network access to DigitalOcean/GoDaddy/SSH** — to a
session running on the user's PC that **does** have that access.

---

## TL;DR for the receiving session

1. The full app is built and pushed. Clone it:
   ```bash
   git clone -b claude/placidcrm-saas-platform-trd4lf \
     https://github.com/simonjohnston123/simonjohnston123.git placidcrm
   cd placidcrm
   ```
2. Deploy to a **NEW** DigitalOcean droplet (do **NOT** touch the existing
   `placid-connect-devbeta` / `168.144.160.107` droplet — it runs a different app):
   ```bash
   doctl auth init            # if not already authenticated
   bash deploy/create-droplet.sh
   ```
   This creates a fresh droplet and auto-installs PlacidCRM (Docker + auto-HTTPS).
3. Point GoDaddy DNS for **placidcrm.com** at the new droplet's IP (A records for
   `@`, `www`, `*`). It currently points to `118.139.166.90`, which is wrong.
4. Open `https://placidcrm.com/register` to create the owner account.

---

## Where the code is

- **GitHub repo:** `simonjohnston123/simonjohnston123`
- **Branch:** `claude/placidcrm-saas-platform-trd4lf`
- **Latest commit at handover:** `4118e4c` ("Add Tasks and Team management to the CRM")
- Everything is committed and pushed; no uncommitted work.

## What it is / tech stack

- **Next.js 14** (App Router, TypeScript, React Server Components, server actions)
- **PostgreSQL** via **Prisma ORM**
- **Tailwind CSS**
- Session auth with **jose** (JWT) + **bcryptjs**
- Ships as a standalone Docker image; production stack adds **Caddy** for automatic HTTPS

## Architecture (GHL-style)

```
Agency ("Placid Group")
  └─ Location = sub-account = one business (isolated data)
        ├─ Placid Storage Solutions   (fully built out, incl. real website)
        ├─ Placid Homestead
        └─ + add more from the dashboard anytime
              Contacts · Pipelines · Tasks · Conversations · Calendar · Website · Settings
```

## Features built (all working, verified against Postgres)

- Multi-tenant Agency → sub-accounts (Locations) with membership roles
- Auth: owner bootstrap via `/register`, sessions, middleware route guards
- Agency dashboard + one-click **Add business** (auto-provisions pipeline, calendar, website)
- **Contacts/CRM**: search, tags, custom fields, notes
- **Pipelines**: Kanban board, move stage, win/lose, multiple pipelines
- **Tasks**: due dates, overdue flagging, assignees, linked to contacts (also on contact page)
- **Team management**: add users, grant/revoke per-sub-account access (Admin/Member); owner-only
- **Conversations**: unified inbox with threads
- **Calendar**: appointments with statuses, per-business calendars
- **Tenant websites**: editable pages/blocks (hero, features, pricing, faq, cta, contact),
  publish toggle, public site at `/sites/<slug>`, lead-capture form → creates a contact
- **Placid Storage Solutions** is built out as a full self-storage website managed in the CRM
  (prices are placeholders — the owner will set the real ones after launch)

## Deployment assets (in the repo)

| File | Purpose |
|------|---------|
| `deploy/create-droplet.sh` | **Create a NEW droplet** via `doctl` (auto-deploys). Preferred. |
| `deploy/cloud-init.yaml` | Droplet user-data: installs Docker + PlacidCRM on first boot |
| `deploy/deploy-on-droplet.sh` | Deploy onto an **existing** Ubuntu droplet (run on the box) |
| `docker-compose.prod.yml` | Prod stack: app + Postgres + Caddy (auto-HTTPS) |
| `Caddyfile` | Reverse proxy + automatic Let's Encrypt certs for placidcrm.com |
| `QUICKSTART.md` | Step-by-step: create droplet → DNS → register |
| `DEPLOY.md` | Detailed manual deploy (nginx variant, backups, troubleshooting) |

Secrets are **not** in the repo — the droplet generates `AUTH_SECRET` and
`POSTGRES_PASSWORD` itself on first boot.

## Deployment context / constraints

- **Existing droplet `placid-connect-devbeta` (`168.144.160.107`, Ubuntu 24.04)** runs a
  *different* project (`placid_storage`, from the user's PC). **Do not disturb it.**
  Create a separate, new droplet for PlacidCRM.
- **DNS now:** `placidcrm.com` → `118.139.166.90` (not a droplet). Repoint `@`, `www`, `*`
  to the new droplet IP. Keep the `*` wildcard so future sub-accounts can get subdomains.
- **TLS:** Caddy auto-issues certs once DNS points at the droplet — nothing manual.

## Run locally (optional sanity check)

```bash
npm install
cp .env.example .env          # set DATABASE_URL + AUTH_SECRET
npm run prisma:push
npm run db:seed               # creates owner + Placid Storage + Placid Homestead
npm run dev                   # http://localhost:3000
```

Seed prints owner login (default `simonjohnston123@gmail.com` / `ChangeMe123!` — change it).

## What's left to do

1. **Create the new droplet** (`deploy/create-droplet.sh` or DigitalOcean console + `cloud-init.yaml`).
2. **Point GoDaddy DNS** at the new droplet IP.
3. **Register the owner** at `/register` and confirm HTTPS is live.
4. (Optional) Set Placid Storage's real unit prices, and build out Placid Homestead's site.

## Suggested next features (post-launch, roadmap in README.md)

Automations/workflows · real Twilio SMS + email · public booking pages ·
CSV import/export · reporting dashboards · Stripe payments · tenant custom domains.
