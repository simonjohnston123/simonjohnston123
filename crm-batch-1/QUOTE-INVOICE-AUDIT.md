# Packet 1–18 — quote → invoice integrity (items 9–18)

Audited against the **running production** `src/lib/customer-quotes.ts` (300 lines).

> **Read item 19 first.** PR #1 on `placidgroup/placid-crm` is titled *"Fix
> country tax and quote-to-invoice integrity"* and touches this exact file. I
> cannot read its version. Everything below is true of **production today**;
> some may already be fixed on that branch. Reconciling PR #1 (item 19) should
> come **before** items 9–16, or the same file gets fixed twice by two authors
> — which on a money path is how two correct-looking changes produce one wrong
> invoice.

## What is already correct — close these, do not rebuild

**Item 15 — optional extras excluded.** `totalsFor` adds optional lines to
`optionalCents` and `continue`s before touching the subtotal. Correct, and the
header explains why. **Closed.**

**Item 14 — tax basis.** GST is rounded once per line, half-up, in `lineMaths`,
and the total is `subtotal + gst` **by construction** rather than recomputed.
`gstRegistered` is snapshotted onto the quote at creation and never re-read.
The arithmetic is right. **Closed** — but see D-7: the snapshot never reaches
the invoice.

**Item 10 — conversion idempotency, sequentially.** `invoiceId` is checked
*before* the status check, and the comment records why the order matters. A
retried tap returns the existing invoice. **Correct for sequential retries**,
not for concurrent ones — see D-8.

---

## D-5 — An expired quote can still be accepted (item 16)

**Severity: medium.** Customer-facing, money-relevant.

`createQuote` sets `validUntil` — 30 days by default — and the comment is
explicit: *"a quote with no expiry is a price you are still honouring in a
year."*

Nothing ever reads it. `acceptQuote` calls `step()`, which checks only the
status flow. There is no `validUntil` comparison anywhere in the file.

So the expiry is displayed but not enforced: a customer can accept a
six-month-old quote at last year's prices and the system will invoice it.

**Fix:** check `validUntil` in `acceptQuote` before the `step()` call and
refuse with a message the public page can render. Needs a product decision on
one point — whether an expired quote is *refused* or *reopened for re-quote* —
so flagging rather than choosing.

## D-6 — Invoice and quote numbers are allocated by COUNT, and two code paths disagree

**Severity: high.** Money path. Produces duplicate invoice numbers.

Both allocators in this file count rows instead of reading the maximum:

```ts
const count = await prisma.customerQuote.count({ where: { locationId } });
return `Q-${String(count + 1).padStart(4, "0")}`;
```

```ts
const count = await prisma.invoice.count({ where: { locationId: quote.locationId } });
number: `INV-${String(count + 1).padStart(4, "0")}`,
```

Three separate problems:

1. **Any deletion causes a collision.** Delete or void one invoice and `count`
   drops by one, so the next conversion proposes a number that already exists.
2. **`convertToInvoice` has no retry loop**, unlike `raiseInvoice`. The unique
   constraint rejects the duplicate and the whole conversion **throws**. The
   accepted quote is left un-invoiced with an error the customer's job is
   blocked behind.
3. **Two allocation schemes for one sequence.** `lib/invoicing.ts` uses
   `max + 1`; this file uses `count + 1`. They only agree while the sequence is
   perfectly gap-free. Any gap — from a deletion, a failed create, a manual
   fix — and the two paths start proposing numbers at different points in the
   same series.

This is a **different defect from D-1**, and worse: D-1 needs 10,000 documents,
this needs one deletion.

**Fix:** both call sites onto the shared `nextNumber` helper from D-1, and give
`convertToInvoice` the same retry loop `raiseInvoice` has. That makes one
allocator for the whole `Invoice` sequence.

## D-7 — The converted invoice loses the lines, the seller and the currency (items 9, 12, 13)

**Severity: high.** The invoice is not a valid tax invoice.

`convertToInvoice` writes exactly seven fields: `locationId`, `contactId`,
`number`, `subtotalCents`, `taxCents`, `totalCents`, `issuedAt`.

Compare what `raiseInvoice` in `lib/invoicing.ts` writes for the same model:
`lines`, `currency`, `sellerName`, `sellerAbn`, `sellerAddress`,
`sellerTaxLabel`, `sellerCompanyNumber`, `sellerEmail`, `sellerPhone`,
`sellerWebsite`, `paidCents`, `paidAt`.

So the converted invoice has:

- **No line items at all.** Item 9 asks for "identical accepted billable
  lines"; the invoice carries a total and nothing to explain it. The quote's
  lines exist in `CustomerQuoteLine` and are simply not copied.
- **No currency.** Item 13. It takes whatever the column defaults to,
  regardless of what the quote was priced in.
- **No seller identity.** Item 12. `lib/seller.ts` is explicit that this must
  be snapshotted so *"a seller that changes its ABN must not silently rewrite
  invoices it has already issued."* The quote even holds `abnSnapshot` — and it
  is not carried across.
- **No `gstRegistered` snapshot**, so nothing downstream can tell whether GST
  was legitimately excluded or merely absent.

The quote's own header says an Australian tax invoice needs the words "Tax
Invoice", the seller's ABN and GST shown. The invoice this produces can show
none of them.

**Item 11 (contact) passes** — `contactId` is carried.

**Fix:** copy the lines, the currency, and the seller snapshot. The cleanest
version routes the conversion through `raiseInvoice` so there is one place that
knows how to build an invoice — but that changes the numbering path too, so it
should land with D-6 rather than separately.

## D-8 — Two simultaneous conversions create two invoices (item 10)

**Severity: medium.** Needs concurrency; produces an orphaned invoice.

The idempotency check is a read-then-write with nothing enforcing it:

```ts
if (quote.invoiceId) { ...return existing... }
...
const invoice = await prisma.invoice.create({ ... });
await prisma.customerQuote.update({ data: { status: "INVOICED", invoiceId: invoice.id } });
```

Two taps at the same moment both read `invoiceId` as null, both create an
invoice, and the second `update` overwrites the first's `invoiceId`. The result
is two invoices for one quote, one of them orphaned but still numbered — so the
invoice sequence has a phantom entry the quote no longer points at.

Same class as D-3 and D-4: a read-then-write guarding a money record, with no
database constraint behind it.

**Fix:** do the create and the quote update in one `prisma.$transaction`, and
add a conditional update (`where: { id, invoiceId: null }`) so the loser of the
race detects it lost and returns the winner's invoice.

---

## Items 17 and 18

**Item 17 — accept end-to-end.** Cannot be exercised without a working staging
deploy. The code path reads correctly (`acceptQuote` → `step` → `ACCEPTED`),
but "reads correctly" is not the same as proven, and D-5 means an expired quote
would pass anyway.

**Item 18 — disabled Send button.** Not in this file. `markSent` throws a
readable error from `step()` for a bad transition, so the message exists; what
is unknown is whether the UI surfaces it or just greys the control. Needs the
quotes UI, which is `app/dashboard/l/[locationId]/quotes/` — readable, and next.
