# `src/app/api/stripe/webhook/route.ts` — the two edits

## 1. Replace the claim block (~line 40)

```diff
-  if (event.id) {
-    try {
-      await prisma.stripeEvent.create({
-        data: { id: event.id, type: event.type ?? "unknown" },
-      });
-    } catch {
-      // Already recorded — a replay. Acknowledge so Stripe stops retrying.
-      return NextResponse.json({ ok: true, duplicate: true });
-    }
-  }
+  // Claimed, then COMPLETED. A row without completedAt is an attempt that did
+  // not finish, not a duplicate — otherwise the 500 below asks for a retry the
+  // dedup is guaranteed to swallow, and a paid order is lost permanently.
+  if (event.id) {
+    const claim = await claimEvent(event.id, event.type ?? "unknown");
+    if (claim === "duplicate") {
+      return NextResponse.json({ ok: true, duplicate: true });
+    }
+    if (claim === "in_flight") {
+      // Another delivery of this same event is mid-handler. Running both would
+      // be the double-grant the claim exists to prevent, so ask Stripe to come
+      // back rather than racing it.
+      return NextResponse.json({ error: "in flight" }, { status: 409 });
+    }
+    // "claimed" or "recovered" — ours to process.
+  }
```

`409` rather than `500`: Stripe retries both, but a 409 in the dashboard says
"a delivery was already running" instead of implying the handler broke.

## 2. Complete the claim on success (end of the `try`, ~line 327)

```diff
     }
+    // Every branch above finished without throwing. Only now is the event
+    // safe to deduplicate on.
+    if (event.id) await completeEvent(event.id);
   } catch (e) {
```

Placed inside the `try`, after the `switch`, so a `break` from any case reaches
it and a throw never does.

**The `catch` is unchanged and must stay unchanged.** It still returns 500 on a
paid-event failure — and that 500 now does what it was always meant to, because
the claim is left incomplete and the retry recovers it once the lease expires.

## 3. Import

```diff
-import { prisma } from "@/lib/db";
+import { prisma } from "@/lib/db";
+import { claimEvent, completeEvent } from "@/lib/webhook-claim";
```

## Prisma schema

```diff
 model StripeEvent {
   id          String   @id
   type        String
   createdAt   DateTime @default(now())
+  startedAt   DateTime @default(now())
+  completedAt DateTime?
+
+  @@index([startedAt], map: "StripeEvent_incomplete_idx")
 }
```

The partial index (`WHERE "completedAt" IS NULL`) is in the migration; Prisma
cannot express a partial index, so leave the SQL as written and let the schema
carry the plain index. Re-running `prisma migrate dev` must not be allowed to
drop the `WHERE` clause.

## What to check after applying

`LEASE_MS` is 5 minutes. It must be **longer than the slowest handler** and
**shorter than Stripe's retry backoff**. If any handler can legitimately run
longer than five minutes, raise it — too short and a live attempt gets taken
over, which is the double-processing this is meant to prevent.
