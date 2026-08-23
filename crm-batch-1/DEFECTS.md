# CRM Release Batch 1 — defect register

Audit of the P0 customer/money journey against the **running production
source** (`f3bbaff`) via the read-only CRM MCP server.

**Read this first — the source I can see is stale in one specific way.** The
MCP serves the running deployment, which is production. It does **not** include
`fix/country-tax-and-marketing-ai`, the branch behind draft PR #1 on
`placidgroup/placid-crm` titled *"Fix country tax and quote-to-invoice
integrity"*. That branch already modifies:

- `src/lib/seller.ts`
- `src/lib/customer-quotes.ts`
- `src/app/dashboard/l/[locationId]/settings/actions.ts`
- `src/components/location-settings-form.tsx`
- `tests/customer-quotes.test.ts`

Those files cover **onboarding → country/tax → quote**, which is the first
two-thirds of this batch. Anything written against the production versions of
them would be written against code that already has an unmerged fix. So this
register deliberately covers only files that branch does **not** touch.

---

## D-1 — Document numbering breaks permanently at 10,000 documents

**Severity: high.** Money path. Silent. Reached by any established business.

**Where — two copies, not four.**

| File | Line | Column type | Affected |
|---|---|---|---|
| `src/lib/invoicing.ts` | 34–41 | `Invoice.number` **String** (schema:3256) | yes |
| `src/lib/quotes.ts` | 101–108 | `Quote.number` **String** (schema:3509) | yes |
| `src/app/dashboard/l/[locationId]/orders/actions.ts` | 69 | `Order.number` **Int** (schema:1840) | **no** |
| `src/lib/storefront-order.ts` | 235 | `Order.number` **Int** | **no** |

**Correction to an earlier version of this register**, which claimed all four.
`Order.number` is `Int @default(0)`, so `orderBy: { number: "desc" }` on it is
a *numeric* sort and is correct at any magnitude. The defect below is specific
to a zero-padded **text** column, which is only `Invoice.number` and
`Quote.number`. `CustomerQuote.number` (schema:4102) is also text and would
carry it, but that file belongs to the open fix branch and is excluded.

The two order call sites have a **different** defect — see D-4.

**The defect.** Each reads the current maximum with:

```ts
findFirst({ where: { locationId }, orderBy: { number: "desc" } })
```

`number` is text, so that is a **lexicographic** sort. It agrees with numeric
order only while every value is the same width. At the 10,000th document the
padding grows from four digits to five and the orders diverge — `"INV-9999"`
sorts above `"INV-10000"`, because `'9' > '1'` at the fifth character.

**Why it is permanent, not transient.** The read returns `INV-9999`, so the
next number computes to `INV-10000`, which already exists. The unique
constraint rejects it. The retry loop then recomputes the *identical* value
five times — `nextNumber` is deterministic and its input has not changed — and
`raiseInvoice` returns `null`. The caller gets no error, only a null. Invoicing
stops for that business and stays stopped.

Note the retry loop *does* work for its stated purpose, concurrency: the
winner's row is visible to the loser's next read. It cannot help here because
the read itself is wrong.

**Second, smaller defect in the same lines.** `Number(last.number.replace(/\D/g, ""))`
strips every non-digit anywhere in the string, so `INV-2026-0001` becomes
`20260001`. Only bites if a numbering format ever carries a year.

**The fix** — `crm-batch-1/next-number.ts`. One shared helper, ordering by
width first and lexicographically within a width, which is numeric order at
every width for zero-padded values. Takes the trailing digit run rather than
every digit. Raw SQL because Prisma cannot express `ORDER BY length(x), x`.

Ordering by `createdAt` instead would be wrong: a backdated or imported record
breaks the assumption that creation order matches numbering order.

**Deliberately not a schema change.** The clean fix is a numeric column or a
counter table. That means backfilling existing rows on live money records,
which is a decision, not a defect fix — flagged for Simon rather than done.
The helper is correct without touching a single stored value.

**Tests** — `crm-batch-1/tests/next-number.test.ts`, 5 assertions, all passing.
Includes a **control** at 500 rows where both orderings agree, so the suite
cannot pass by measuring nothing, and a reproduction that asserts the defective
ordering really does return the wrong row before asserting the fix returns the
right one.

**Not yet applied to the four call sites** — that needs write access to
`placidgroup/placid-crm`.

---

## D-2 — A failed paid webhook can never be retried: the dedup eats every retry

**Severity: high.** Money path. Silent. **Needs your decision** — the safe fix
is a schema change.

**Where:** `src/app/api/stripe/webhook/route.ts`, lines ~43 (claim) and ~329
(retry). Not touched by the fix branch.

**The defect.** Two safeguards were added deliberately, and they cancel each
other out.

The event id is claimed by INSERT *before* the handler runs — correct, and for
a good reason the comment states: a read-then-write check loses a race, only
the unique key can arbitrate. A duplicate insert returns 200 `duplicate`.

The handler then runs. If it throws on a paid event, the catch returns **500 so
Stripe retries** — also correct, and the comment is right that *"losing a paid
order silently is not something a log line makes better."*

But nothing releases the claim. So the retry arrives, hits the dedup, and is
acknowledged as a duplicate. The order is never recorded.

```
delivery 1  claim ok -> handler throws -> 500 "not recorded"   (Stripe will retry)
delivery 2  claim FAILS (row exists)  -> 200 "duplicate"        (never processed)
delivery 3  claim FAILS               -> 200 "duplicate"
=> money taken, order never recorded, permanently
```

**The 500-retry path is dead code in practice.** It can only ever fire on the
first delivery, and the retry it asks for is guaranteed to be swallowed. The
failure mode it was written to prevent is the exact one it produces.

Proof: `crm-batch-1/tests/webhook-idempotency.proof.js`, runnable with `node`.
It includes two controls — a first-time success records the order, and a true
replay of a *succeeded* event is correctly ignored — so it cannot pass by
measuring nothing.

**Why this is a decision, not a defect fix.** Three options, and the cheapest
is not the safest:

1. **Delete the claim before returning 500.** No schema change. But it re-runs
   a handler that may have *partially* completed — if `applyTopup` granted
   credits and a later step threw, the retry grants them again. That is the
   double-spend the credit tests exist to prevent, reintroduced at the webhook
   layer.
2. **Add `completedAt` to `StripeEvent`** and treat a row as a duplicate only
   when it is complete; an incomplete row means a previous attempt died, so
   reprocess. Correct, and it makes the 500 path actually work. Costs a
   migration on a money table.
3. **Make every handler individually idempotent** and keep claim-before-work.
   Several already are — `recordStorefrontOrder`, the `helpRequest` branches
   and the `one_time` branch all check for an existing row first. `applyTopup`
   needs verifying. Most correct long-term, largest change.

**My recommendation: 2, then 3.** Option 2 is small, mechanical, and fixes the
silent-loss case immediately. Option 1 trades a silent loss for a possible
double-grant, which on a credit ledger is the worse of the two.

I have not implemented any of them — this changes money-handling semantics on
live records, which is the boundary you asked me to stop at.

---

## D-4 — Two orders placed at the same moment get the same order number

**Severity: high.** Customer-facing. Silent. No error, no exception, two rows.

**Where:** `src/lib/storefront-order.ts:227–236`, and the same shape at
`src/app/dashboard/l/[locationId]/orders/actions.ts:69`.

**The defect.** The order's *identity* is idempotent and carefully so — the
primary key is `ord_<stripe session id>`, and the file's header explains why:

> Idempotency is the order's primary key: `ord_<session id>`. A second attempt
> collides on the id and is dropped, with no unique index to add and no
> read-then-write race to lose.

That is true, and it is the right design. But the order's **number** is not
covered by it:

```ts
const last = await prisma.order.findFirst({
  where: { locationId }, orderBy: { number: "desc" }, select: { number: true },
});
...
number: (last?.number ?? 0) + 1,
```

That is a read-then-write, and the thing it writes is not what the row is keyed
on. Two **different** shoppers checking out at the same moment both read the
same maximum and both write `N + 1`. Neither `create` fails, because they
collide on nothing — their ids differ. The result is two distinct orders
sharing one order number.

The header's reassurance is what makes this easy to miss: the *dedup* race was
genuinely solved, so the *numbering* race reads as if it were solved too.

**Why it is worse than the invoice case.** D-1 fails loudly-ish — the write is
rejected and the caller gets a null. This one succeeds. Two customers are told
they are order 41, the fulfilment desk has two order 41s, and nothing anywhere
reports a problem. It surfaces as a support conversation, days later.

**Not the same bug as D-1.** `Order.number` is an integer, so the sort is
correct. The fix here is not a better sort — it is making the number a value
the database assigns rather than one the application guesses.

**The fix, and why it needs a decision.** Three options:

1. **A unique constraint on `(locationId, number)` plus a retry loop.** The
   loser of the race collides, re-reads, and takes the next number. Small, and
   it makes the existing pattern honest. Costs a migration — and, like D-3, it
   **fails if duplicates already exist**, so it needs a count first.
2. **A per-location counter row updated in the same transaction.** Correct
   without a retry, but a new table and a hot row.
3. **A Postgres sequence per location.** Cleanest, worst fit for a schema
   Prisma manages.

I would do 1. But the query below decides whether this is a schema change or an
incident:

```sql
SELECT "locationId", "number", count(*) FROM "Order"
 GROUP BY 1,2 HAVING count(*) > 1 ORDER BY 3 DESC;
```

If that returns rows, duplicate order numbers are already in the data and
customers have already been given them.

Not implemented — a migration on live order records.

---

## D-3 — `applyTopup` guards a money grant with a check the database does not enforce

**Severity: medium today, high if anything else ever calls it.** Money path.

**Where:** `src/lib/credit.ts:104`, and `prisma/schema.prisma` around line 764.

```ts
const already = await prisma.creditEntry.findFirst({ where: { locationId, ref } });
if (already) return false;
await addCredit(locationId, Math.round(cents), { kind: "topup", note: "Card top-up", ref });
```

**The defect.** That is a read-then-write check, and **`CreditEntry` has no unique
constraint on `(locationId, ref)`** — its only index is
`@@index([locationId, createdAt])`. So two concurrent calls with the same
session id both pass `findFirst` and both call `addCredit`. The customer is
credited twice for one payment.

The function's own docstring says it "has to be safe to run twice on the same
session", and for a *sequential* retry it is — the first call's ledger entry is
visible to the second. It is the simultaneous case it cannot survive, and
nothing in the schema catches it.

This is precisely the pattern the webhook route rejects for itself, in a
comment two files away:

> Claimed by INSERT rather than checked-then-written: two deliveries landing at
> the same instant both pass a read-first check, and the unique primary key is
> the only thing that can actually arbitrate between them.

Right diagnosis, applied in one place and not the other.

**Why it is only medium today.** The webhook's event-id claim currently stops
two deliveries of the same event reaching `applyTopup` at once, so the outer
guard is doing the work the inner one cannot. That makes this a latent defect
rather than a live one — but the protection is incidental, lives in a different
file, and nothing states the dependency.

**Why it becomes high.** Any second caller without that outer claim — a
success-page handler reconciling a return from Stripe, a manual replay tool, a
backfill — reintroduces the race immediately. Nothing in `credit.ts` warns a
future author that its safety is on loan.

**The fix, and why it needs a decision.** Add
`@@unique([locationId, ref])` to `CreditEntry` and let `addCredit` fail on the
constraint instead of checking first. Small, correct, and it makes the
docstring true.

It is a migration on a live ledger table, and it will FAIL if any duplicate
`(locationId, ref)` rows already exist. So it needs a count first:

```sql
SELECT "locationId", "ref", count(*) FROM "CreditEntry"
 WHERE "ref" IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
```

If that returns rows, the race has **already happened** and those are real
double-grants to reconcile before the index can be added. Run it before writing
the migration — the answer changes whether this is a schema change or an
incident.

Not implemented. Same reason as D-2: it changes money-handling semantics on
live records.

---

## Observations, not defects

**`locationSeller` hardcodes AU/NZ inclusive rates** (`src/lib/seller.ts:104`)
keyed on a lowercased country string, while `taxOn`'s own doc comment names the
UK and Philippines as inclusive and the US as exclusive. A UK location
therefore gets no tax line. The code says this is deliberate — *"Only the
inclusive rates we are sure of. Anywhere else gets no tax line rather than a
guessed one"* — and that is the right call for a system that declares tax
rather than computing it. Listed only because it is the gap the fix branch is
likely addressing; it should be checked against that branch, not against this.

**A null country defaults to Australia** (`l.country ?? "Australia"`), so a
location with no country set but a tax number gets 10% GST on its documents.
Defensible as a base-market default, but it is an inferred tax rate in a file
whose stated rule is that tax is declared. Worth a deliberate answer.

---

## Blocked

Everything in `fix/country-tax-and-marketing-ai`'s file list —
onboarding, country/tax, quote, and quote-to-invoice conversion. Not blocked on
access alone: the fix exists and is unreviewed, and writing a second fix for
the same money paths without seeing the first is how two correct-looking
changes produce one wrong invoice.
