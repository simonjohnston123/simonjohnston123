# PlacidCRM

An all-in-one, **multi-tenant CRM SaaS platform** for the Placid group of
businesses — built in the style of GoHighLevel (GHL). One platform runs an
**agency** (PlacidCRM) with any number of **sub-accounts** (individual
businesses), each with its own CRM, pipelines, conversations, calendar and
public website. Add a new business whenever you launch one.

> Live domain: **placidcrm.com** · Hosting: your DigitalOcean droplet (see
> [`DEPLOY.md`](./DEPLOY.md)).

---

## The model (how it maps to GHL)

```
Agency  ─────────────  "Placid Group"      (the whole platform / you, the owner)
  └─ Location ────────  a sub-account = one business
        ├─ Placid Storage Solutions
        ├─ Placid Homestead
        └─ …add more anytime
              ├─ Contacts, tags, custom fields   (CRM)
              ├─ Pipelines + opportunities       (Kanban sales tracking)
              ├─ Conversations                   (unified inbox)
              ├─ Calendar + appointments         (booking)
              └─ Website                         (public marketing site)
```

- **Separate or shared:** each business is its own sub-account with isolated
  data. One login (the owner / super-admin) can switch between all of them; you
  can also give a teammate access to just one business.
- **Add a business in a click:** the **+ Add business** button provisions a new
  sub-account complete with a starter pipeline, a calendar and a draft website.

## What's built (Phase 1 — this release)

| Area | Status |
|------|--------|
| Multi-tenant agency → sub-account architecture | ✅ |
| Auth (owner bootstrap, sessions, route guards) | ✅ |
| Agency dashboard + add-business flow | ✅ |
| Contacts / CRM (search, tags, custom fields, notes) | ✅ |
| Pipelines & opportunities (Kanban, move stage, win/lose) | ✅ |
| Conversations (unified inbox, threads, send/receive) | ✅ |
| Calendar & appointments (book, status, per-business calendars) | ✅ |
| Tenant websites (editable pages, publish, lead capture) | ✅ |
| Public website lead → CRM contact | ✅ |
| Docker + nginx + DigitalOcean deploy | ✅ |

Two businesses — **Placid Storage Solutions** and **Placid Homestead** — are
included in the seed so you can see it working immediately.

## Tech stack

- **Next.js 14** (App Router, React Server Components, server actions) + **TypeScript**
- **PostgreSQL** via **Prisma ORM**
- **Tailwind CSS**
- Session auth with **jose** (JWT) + **bcryptjs**
- Deploys as a single Docker image (`output: "standalone"`) behind **nginx**

## Run it locally

```bash
# 1. Install deps
npm install

# 2. Start Postgres (any local Postgres works). With Docker:
#    docker run -d --name placid-pg -e POSTGRES_USER=placid \
#      -e POSTGRES_PASSWORD=placid -e POSTGRES_DB=placidcrm -p 5432:5432 postgres:16

# 3. Configure env
cp .env.example .env
#    set DATABASE_URL + AUTH_SECRET (openssl rand -base64 48)

# 4. Create tables and seed the two Placid businesses
npm run prisma:push
npm run db:seed

# 5. Start
npm run dev
```

Then open <http://localhost:3000>:

- **/register** — create the owner account (first run only), **or**
- **/login** — sign in with the seeded owner (printed by `db:seed`).
- **/sites/placid-storage-solutions** and **/sites/placid-homestead** — the live tenant sites.

## Project layout

```
prisma/schema.prisma        # the whole data model (tenancy, CRM, sites)
prisma/seed.ts              # owner + Placid Storage + Placid Homestead
src/lib/                    # db, auth/sessions, provisioning, helpers
src/middleware.ts           # protects /dashboard
src/app/(auth)/             # login / register + auth server actions
src/app/dashboard/          # agency dashboard + add business
src/app/dashboard/l/[id]/   # per-business: contacts, pipelines, conversations,
                            #   calendar, website, settings
src/app/sites/[slug]/       # public tenant websites + lead capture
Dockerfile, docker-compose.yml, nginx/   # deployment
DEPLOY.md                   # step-by-step DigitalOcean + GoDaddy guide
```

## Security notes

- The first `/register` creates the super-admin, then public sign-up closes.
- Every dashboard route is guarded by middleware; every server action re-checks
  that the user has access to the specific sub-account before reading/writing.
- Public tenant sites can only create a contact for their own business.
- `AUTH_SECRET` must be a strong random value in production.

## Roadmap toward GHL feature-parity

Phase 1 is a genuinely usable multi-business CRM. GHL is enormous; these are the
natural next phases, roughly in priority order:

- **Automations / workflows** — triggers (new lead, tag added, appointment
  booked) → actions (send email/SMS, move pipeline, wait, notify).
- **Real email & SMS** — wire conversations to Twilio (SMS/WhatsApp) and a
  provider like Postmark/SendGrid (email), with inbound webhooks.
- **Public calendar booking pages** — customer-facing self-booking with
  availability, feeding the existing appointment model.
- **Funnels / drag-and-drop site builder** — a visual block editor on top of the
  current page/blocks schema.
- **Team management & granular roles** — invite users, per-sub-account
  permissions (the `Membership`/role model is already in place).
- **Payments & invoicing** — Stripe per sub-account.
- **Tenant custom domains with automatic TLS** — e.g. via Caddy.
- **Reporting dashboards, memberships/courses, reputation/reviews.**

Each builds on the multi-tenant foundation already shipped here.
