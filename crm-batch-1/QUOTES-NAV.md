# Why Quotes is invisible — and why it is not a deployment problem

**Backlog item 58 is misfiled.** It reads *"current `main` already contains the
entry, but staging is behind."* Deploying `main` will not surface Quotes.
Confirmed independently on the running production system.

## Reproduced

`get_nav` for Safety Cert SEQ (`cms6sqk5x0001xd6rqz0bowmx`), plan `free`:

```
Not shown (1):
    quotes    Quotes — not part of this business's CRM — no capability record for it
```

Note `invoices` **is** shown, and so are ~40 other tabs. Only `quotes` is
missing, and the reason string distinguishes the capability case from the plan
case — so this is not plan-gating.

## The mechanism

`src/lib/nav-config.ts:357`:

```ts
const given = (item: NavItem) => !has || item.always || has.has(item.key);
```

`has` is the set of `LocationCapability` keys for the business.

- If a business has **no** capability rows, `!has` is true and **everything is
  granted**.
- If it has **any** rows, the set becomes a **closed allowlist**: only `always`
  items and keys explicitly present are shown.

`quotes` is registered at `nav-config.ts:113` and is **not** `always`.

## Why the set doesn't contain it

`prisma/migrations/20260815c_location_capabilities/` created the table on
**15 August** and backfilled each business's rows — two `INSERT ... SELECT`
statements, so the grant was conditional rather than blanket.

The Quotes nav key was added **after** that migration. Nothing backfilled it.
Every business that received rows on 15 August therefore has a set that cannot
contain `quotes`, and the allowlist excludes it.

## This is systemic, not a Quotes bug

**Any nav key added after a business's capability rows were written is
invisible to that business, permanently, with no error.** The feature ships,
the route works, the entry is registered, and it silently does not appear. The
next tab added has the same problem.

That is the finding worth keeping. Quotes is the instance that surfaced it.

## The fix

An additive migration inserting `quotes` for locations that **already have**
capability rows. Businesses with none must be left alone — `!has` already
grants them everything, and giving them a single row would flip them from
"everything" to "only quotes".

```sql
INSERT INTO "LocationCapability" ("id", "locationId", "key", "source", "enabledAt")
SELECT gen_random_uuid(), l."id", 'quotes', 'backfill', now()
  FROM "Location" l
 WHERE EXISTS (SELECT 1 FROM "LocationCapability" c WHERE c."locationId" = l."id")
   AND NOT EXISTS (SELECT 1 FROM "LocationCapability" c
                    WHERE c."locationId" = l."id" AND c."key" = 'quotes')
ON CONFLICT ("locationId", "key") DO NOTHING;
```

Confirm `source` accepts `'backfill'` — the 15 August migration set it, and its
value should match whatever that used.

### The decision, which is Simon's

**Does every business get Quotes, or only some?** The 15 August backfill was
conditional, which implies capability grants are meant to reflect what a
business actually does. Blanket-granting Quotes contradicts that model; the
alternative is granting it per industry, or on request.

The query above is the blanket version. If it should be conditional, the
`WHERE` needs the same predicate the original migration used — which is in
`scripts/`-adjacent migration SQL that is readable, and should be read before
choosing.

### The process fix, separately

Adding a nav key needs to be accompanied by a backfill, or it is invisible to
every existing business. Worth a note in whatever checklist governs nav
changes, because nothing in the code makes this failure visible — the tab just
doesn't render.
