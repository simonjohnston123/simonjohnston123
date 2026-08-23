# D-1 — exact patches for `lib/invoicing.ts` and `lib/quotes.ts`

Formats are preserved: `INV-0000` and `Q-0000`, both 4-padded. The retry loops
are left exactly as they are — they were never the defect, and with the read
fixed they now make progress instead of recomputing the same value.

**`Order.number` is deliberately untouched.** It is `Int @default(0)`
(schema:1840), so `orderBy: { number: "desc" }` on it is already a numeric sort.
It has a different defect — see D-4.

## 1. `src/lib/invoicing.ts`

```diff
+import { nextNumber } from "@/lib/next-number";
+
-/**
- * The next number for this business.
- *
- * Sequential and gap-free per business, because an invoice sequence with
- * holes in it is the first thing an auditor asks about. Retried on a clash so
- * two simultaneous payments can't both take INV-0007.
- */
-async function nextNumber(locationId: string): Promise<string> {
-  const last = await prisma.invoice.findFirst({
-    where: { locationId },
-    orderBy: { number: "desc" },
-    select: { number: true },
-  });
-  const n = last ? Number(last.number.replace(/\D/g, "")) + 1 : 1;
-  return `INV-${String(n).padStart(4, "0")}`;
-}
```

and at the call site:

```diff
-    const number = await nextNumber(opts.locationId);
+    const number = await nextNumber("invoice", opts.locationId, "INV-");
```

## 2. `src/lib/quotes.ts`

```diff
+import { nextNumber } from "@/lib/next-number";
+
-/**
- * Sequential per business, gap-free, retried on a clash — the same rule the
- * invoice numbers follow, for the same reason.
- */
-async function nextNumber(locationId: string): Promise<string> {
-  const last = await prisma.quote.findFirst({
-    where: { locationId },
-    orderBy: { number: "desc" },
-    select: { number: true },
-  });
-  const n = last ? Number(last.number.replace(/\D/g, "")) + 1 : 1;
-  return `Q-${String(n).padStart(4, "0")}`;
-}
```

and at the call site:

```diff
-    const number = await nextNumber(opts.locationId);
+    const number = await nextNumber("quote", opts.locationId, "Q-");
```

## 3. Add `src/lib/next-number.ts`

Copy `crm-batch-1/next-number.ts` verbatim.

## What the retry loop does now

Unchanged in shape, correct in effect. Two simultaneous callers still compute
the same value; the unique constraint still rejects the loser; the loser's next
read now returns the winner's row **and reads it correctly**, so it gets `N+1`
rather than recomputing `N` five times and returning null.

## Note on padding beyond four digits

`padStart(4, …)` is a floor, not a cap — `String(10000).padStart(4,"0")` is
`"10000"`. So `INV-10000` follows `INV-9999` naturally and no format change is
needed. That is also precisely why the text sort breaks there: the width grows.
