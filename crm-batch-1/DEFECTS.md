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

**Where — four copies of the same eight lines:**

| File | Line | Documents affected |
|---|---|---|
| `src/lib/invoicing.ts` | 34–41 | invoices |
| `src/lib/quotes.ts` | 101–108 | quotes |
| `src/app/dashboard/l/[locationId]/orders/actions.ts` | 69 | dashboard orders |
| `src/lib/storefront-order.ts` | 235 | storefront orders |

(A fifth, `src/lib/customer-quotes.ts:113`, is in the fix branch — excluded.)

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
